import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as _ from 'lodash';
import { User, UserDocument } from '../schemas/user.schema';
import { Post, PostDocument } from '../schemas/post.schema';

@Injectable()
export class UsersService {
  private readonly limit = 10;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}

  // ==================== My Ads ====================

  async myAdsAnalytic(userId: string) {
    const posts = await this.postModel
      .find({ userID: userId as any })
      .select({ status: 1 })
      .lean()
      .exec();

    const analytic = {
      block: 0,
      post: 0,
      wait: 0,
      done: 0,
      cancel: 0,
    };

    if (posts && posts.length > 0) {
      analytic.block = _.sumBy(posts, (o: any) => (o.status == 0 ? 1 : 0));
      analytic.post = _.sumBy(posts, (o: any) => (o.status == 2 ? 1 : 0));
      analytic.wait = _.sumBy(posts, (o: any) => (o.status == 1 ? 1 : 0));
      analytic.done = _.sumBy(posts, (o: any) => (o.status == 3 ? 1 : 0));
      analytic.cancel = _.sumBy(posts, (o: any) => (o.status == 4 ? 1 : 0));
    }

    return analytic;
  }

  async myAdsDetails(userId: string, query: any) {
    let page = 1;
    const filter: any = { userID: userId as any };

    if (query.page) {
      page = parseInt(query.page, 10);
    }
    const skip = (page - 1) * this.limit;
    const pageNext = page + 1;

    if (query.type) {
      filter.status = parseInt(query.type, 10);
    }

    const posts = await this.postModel
      .find(filter)
      .select({
        category_alias: 1,
        title: 1,
        price: 1,
        image: 1,
        has_thumb: 1,
        city: 1,
        area: 1,
        createdAt: 1,
      })
      .lean()
      .skip(skip)
      .limit(this.limit)
      .sort({ createdAt: -1 })
      .exec();

    return { data: posts || [], pageNext, userID: userId };
  }

  async myAdsUpdateStatus(userId: string, body: any) {
    const { id, type } = body;

    if (!id || !type) {
      throw new HttpException(
        { status: false, msg: 'Không tìm thấy tin đăng phù hợp!' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const typeNum = parseInt(type, 10);
    const query: any = { _id: id };
    const statusConditions: any[] = [];

    switch (typeNum) {
      case 1:
        statusConditions.push({ status: 4 });
        break;
      case 3:
        statusConditions.push({ status: 2 });
        break;
      case 4:
        statusConditions.push({ status: 1 }, { status: 2 });
        break;
      case 6:
        statusConditions.push(
          { status: 3 },
          { status: 4 },
          { status: 5 },
        );
        break;
    }

    query.$or = statusConditions;

    const post = await this.postModel.findOne(query).select({ status: 1 }).exec();

    if (post) {
      post.status = typeNum;
      try {
        await post.save();
        return { status: true, old_status: post.status };
      } catch (err) {
        throw new HttpException(
          { status: false, msg: 'Cập nhật trạng thái thất bại!' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } else {
      throw new HttpException(
        { status: false, msg: 'Không tìm thấy tin đăng phù hợp!' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async myAdsUpdateTime(body: any) {
    const { id } = body;

    if (!id) {
      throw new HttpException(
        { status: false, msg: 'Không tìm thấy tin đăng phù hợp!' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const anHourAgo = Date.now() - 60 * 60 * 1000;
    const query = { _id: id, createdAt: { $lte: anHourAgo } };

    const bumpPost = await this.postModel.bulkWrite([
      {
        updateOne: {
          filter: query,
          update: { $set: { createdAt: Date.now() } },
        },
      },
    ]);

    if (!bumpPost.modifiedCount) {
      return {
        status: false,
        msg: 'Đẩy tin thất bại. Bạn chỉ có thể đẩy lại tin mỗi giờ một lần duy nhất!',
      };
    }
    return { status: true, msg: 'Đẩy tin thành công!' };
  }

  // ==================== My Profile ====================

  async putMyInfo(userId: string, body: any) {
    const userUpdate: any = {};
    const query = { _id: userId };

    if (body.phone || body.yourname) {
      if (body.phone && body.phone !== '') {
        // Validate phone
        if (!/^\d{9,11}$/.test(body.phone)) {
          return {
            status: false,
            type: 1,
            phone: 'Số điện thoại không hợp lệ',
          };
        }
        userUpdate.phone = body.phone;
      }

      if (body.yourname && body.yourname !== '') {
        // Validate name
        if (body.yourname.length < 3 || body.yourname.length > 20) {
          return {
            status: false,
            type: 1,
            yourname: 'Tên của bạn gồm 3-20 ký tự',
          };
        }
        // Remove special chars
        userUpdate.name = body.yourname.replace(/[\[\]!@#$%^&*()?:;<>{}]/g, '');
      }

      if (!_.isEmpty(userUpdate)) {
        const result = await this.userModel.bulkWrite([
          {
            updateOne: {
              filter: query,
              update: userUpdate,
            },
          },
        ]);

        if (result.modifiedCount) {
          return { status: true, msg: 'Cập nhật thông tin thành công!' };
        } else {
          return { status: false, msg: 'Cập nhật thông tin thất bại!' };
        }
      }
    } else if (body.oldpassword && body.newpassword && body.repassword) {
      // Validate password
      if (body.oldpassword.length < 6 || body.oldpassword.length > 20) {
        return {
          status: false,
          type: 1,
          oldpassword: 'Mật khẩu gồm 6-20 ký tự',
        };
      }
      if (body.newpassword.length < 6 || body.newpassword.length > 20) {
        return {
          status: false,
          type: 1,
          newpassword: 'Mật khẩu gồm 6-20 ký tự',
        };
      }
      if (body.newpassword !== body.repassword) {
        return {
          status: false,
          type: 1,
          repassword: 'Nhập lại mật khẩu không chính xác',
        };
      }

      const user = await this.userModel.findOne({ _id: userId }).exec();
      if (!user) {
        return { status: false, type: 1, oldpassword: 'Tài khoản không hợp lệ!' };
      }

      const isMatch = bcrypt.compareSync(body.oldpassword, user.password);
      if (!isMatch) {
        return {
          status: false,
          type: 1,
          oldpassword: 'Mật khẩu hiện tại không chính xác!',
        };
      }

      const hash = bcrypt.hashSync(body.newpassword, bcrypt.genSaltSync(10));
      userUpdate.password = hash;

      if (!_.isEmpty(userUpdate)) {
        const result = await this.userModel.bulkWrite([
          {
            updateOne: {
              filter: query,
              update: userUpdate,
            },
          },
        ]);

        if (result.modifiedCount) {
          return { status: true, msg: 'Cập nhật mật khẩu thành công!' };
        } else {
          return { status: false, msg: 'Cập nhật mật khẩu thất bại!' };
        }
      }
    }

    return { status: false, msg: 'Không có dữ liệu để cập nhật!' };
  }

  // ==================== Favorite ====================

  async getFavorite(userId: string, query: any) {
    let page = 1;
    if (query.page) {
      page = parseInt(query.page, 10);
    }
    const skip = (page - 1) * this.limit;
    let pageNext = page + 1;

    const user = await this.userModel.findById(userId).select({ favorite: 1 }).lean().exec();
    if (!user) {
      return { data: [], pageNext: 1 };
    }

    const posts = await this.postModel
      .find({ _id: { $in: user.favorite } })
      .select({
        category_alias: 1,
        title: 1,
        price: 1,
        image: 1,
        has_thumb: 1,
        area: 1,
        city: 1,
        createdAt: 1,
      })
      .lean()
      .skip(skip)
      .limit(this.limit)
      .sort({ createdAt: -1 })
      .exec();

    if (posts.length === this.limit) {
      pageNext = page + 1;
    } else {
      pageNext = 1;
    }

    return { data: posts || [], pageNext };
  }

  async saveFavorite(userId: string, body: any) {
    const { id } = body;

    if (!id) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    const count = await this.postModel.countDocuments({ _id: id }).exec();
    if (!count) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    if (user.favorite.indexOf(id.toString()) < 0) {
      try {
        await this.userModel.updateOne(
          { _id: userId },
          { $push: { favorite: id } },
        );
        return { status: true, msg: 'Đã LƯU vào danh sách yêu thích!' };
      } catch (err) {
        return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
      }
    } else {
      return {
        status: false,
        msg: 'Tin đăng ĐÃ TỒN TẠI trong danh sách yêu thích của bạn!',
      };
    }
  }

  async unSaveFavorite(userId: string, body: any) {
    const { id } = body;

    if (!id) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    const count = await this.postModel.countDocuments({ _id: id }).exec();
    if (!count) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    if (user.favorite.indexOf(id.toString()) >= 0) {
      const newFavorite = user.favorite.filter(
        (fId) => fId.toString() !== id.toString(),
      );
      try {
        await this.userModel.updateOne(
          { _id: userId },
          { favorite: newFavorite },
        );
        return { status: true, msg: 'Đã XÓA khỏi danh sách yêu thích!' };
      } catch (err) {
        return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
      }
    } else {
      return {
        status: false,
        msg: 'Tin đăng KHÔNG tồn tại trong danh sách yêu thích của bạn!',
      };
    }
  }

  async unSaveAllFavorite(userId: string) {
    const result = await this.userModel.bulkWrite([
      {
        updateOne: {
          filter: { _id: userId, favorite: { $ne: [] } },
          update: { $set: { favorite: [] } },
        },
      },
    ]);

    if (result.modifiedCount) {
      return { status: true };
    } else {
      return { status: false, msg: 'Thực hiện thất bại. Vui lòng thử lại!' };
    }
  }

  // ==================== Search ====================

  async getSearch(userId: string, query: any) {
    let page = 1;
    if (query.page) {
      page = parseInt(query.page, 10);
    }
    const skip = (page - 1) * this.limit;
    const pageNext = page + 1;

    const results = await this.userModel.aggregate([
      { $match: { _id: userId } },
      { $project: { search: 1 } },
      { $unwind: '$search' },
      { $skip: skip },
      { $limit: this.limit },
      { $project: { _id: 0, search: 1 } },
    ]).exec();

    if (results && results.length > 0) {
      const mysearch = results.map((o) => o.search);
      return { status: true, data: mysearch, pageNext };
    } else {
      return { status: false };
    }
  }

  async saveSearch(userId: string, body: any) {
    const { url, title } = body;

    if (!url) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    const cleanedUrl = url.replace(/page=[0-9]*$/g, 'page=1');
    // HTML-encode the title to prevent XSS (mirrors the entities.encode from original code)
    const encodedTitle = title
      ? title
          .replace(/&/g, '&')
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/"/g, '"')
          .replace(/'/g, '&#039;')
      : '';

    const result = await this.userModel.bulkWrite([
      {
        updateOne: {
          filter: { _id: userId },
          update: {
            $push: { search: { title: encodedTitle, url: cleanedUrl } },
          },
        },
      },
    ]);

    if (result.modifiedCount) {
      return { status: true, msg: 'Thành công! Bạn đã lưu tìm kiếm này.' };
    } else {
      return {
        status: false,
        msg: 'Lưu tìm kiếm thất bại. Vui lòng thử lại!',
      };
    }
  }

  async unSaveSearch(userId: string, body: any) {
    const { id } = body;

    if (!id) {
      return { status: false, msg: 'Thực hiện thất bại. Vui lòng thử lại!' };
    }

    const result = await this.userModel.bulkWrite([
      {
        updateOne: {
          filter: { _id: userId, 'search._id': id },
          update: { $pull: { search: { _id: id } as any } },
        },
      },
    ]);

    if (result.modifiedCount) {
      return { status: true, msg: 'Thành công! Tìm kiếm đã được hủy.' };
    } else {
      return { status: false, msg: 'Thực hiện thất bại. Vui lòng thử lại!' };
    }
  }

  async unSaveAllSearch(userId: string) {
    const result = await this.userModel.bulkWrite([
      {
        updateOne: {
          filter: { _id: userId, search: { $ne: [] } },
          update: { $set: { search: [] } },
        },
      },
    ]);

    if (result.modifiedCount) {
      return { status: true };
    } else {
      return { status: false, msg: 'Thực hiện thất bại. Vui lòng thử lại!' };
    }
  }
}