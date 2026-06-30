import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as _ from 'lodash';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly limit = 10;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject('POST_SERVICE') private postServiceClient: ClientProxy,
  ) { }

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

    const user = await this.userModel.findById(userId).select({ favorite: 1 }).lean().exec();
    if (!user) {
      return { data: [], pageNext: 1 };
    }

    const posts = await firstValueFrom(
      this.postServiceClient.send({ cmd: 'get_posts_by_ids' }, { ids: user.favorite, skip, limit: this.limit })
    ).catch(() => []);

    const pageNext = posts.length === this.limit ? page + 1 : null;
    return { data: posts || [], pageNext };
  }

  async saveFavorite(userId: string, body: any) {
    const { id } = body;

    if (!id) {
      return { status: false, msg: 'Không TÌM THẤY tin đăng phù hợp!' };
    }

    const count = await firstValueFrom(
      this.postServiceClient.send({ cmd: 'check_post_exists' }, id)
    ).catch(() => 0);
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

    const count = await firstValueFrom(
      this.postServiceClient.send({ cmd: 'check_post_exists' }, id)
    ).catch(() => 0);
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