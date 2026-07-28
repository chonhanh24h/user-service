import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as _ from 'lodash';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { User, UserDocument } from '../schemas/user.schema';
import { UserMessage } from '../const/users.enum';
import {
  PAGINATION_LIMIT,
  PHONE_REGEX,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  BCRYPT_SALT_ROUNDS,
  SPECIAL_CHARS_REGEX,
  POST_SERVICE_NAME,
  CMD_GET_POSTS_BY_IDS,
  CMD_CHECK_POST_EXISTS,
} from '../const/users.constant';

@Injectable()
export class UsersService {
  private readonly limit = PAGINATION_LIMIT;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(POST_SERVICE_NAME) private postServiceClient: ClientProxy,
  ) {}

  async putMyInfo(userId: string, body: any) {
    const userUpdate: any = {};
    const query = { _id: userId };

    if (body.phone || body.yourname) {
      if (body.phone && body.phone !== '') {
        // Validate phone
        if (!PHONE_REGEX.test(body.phone)) {
          return {
            status: false,
            type: 1,
            phone: UserMessage.INVALID_PHONE,
          };
        }
        userUpdate.phone = body.phone;
      }

      if (body.yourname && body.yourname !== '') {
        // Validate name
        if (
          body.yourname.length < NAME_MIN_LENGTH ||
          body.yourname.length > NAME_MAX_LENGTH
        ) {
          return {
            status: false,
            type: 1,
            yourname: UserMessage.INVALID_NAME_LENGTH,
          };
        }
        // Remove special chars
        userUpdate.name = body.yourname.replace(SPECIAL_CHARS_REGEX, '');
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
          return { status: true, msg: UserMessage.UPDATE_INFO_SUCCESS };
        } else {
          return { status: false, msg: UserMessage.UPDATE_INFO_FAILED };
        }
      }
    } else if (body.oldpassword && body.newpassword && body.repassword) {
      // Validate password
      if (
        body.oldpassword.length < PASSWORD_MIN_LENGTH ||
        body.oldpassword.length > PASSWORD_MAX_LENGTH
      ) {
        return {
          status: false,
          type: 1,
          oldpassword: UserMessage.INVALID_PASSWORD_LENGTH,
        };
      }
      if (
        body.newpassword.length < PASSWORD_MIN_LENGTH ||
        body.newpassword.length > PASSWORD_MAX_LENGTH
      ) {
        return {
          status: false,
          type: 1,
          newpassword: UserMessage.INVALID_PASSWORD_LENGTH,
        };
      }
      if (body.newpassword !== body.repassword) {
        return {
          status: false,
          type: 1,
          repassword: UserMessage.PASSWORD_MISMATCH,
        };
      }

      const user = await this.userModel.findOne({ _id: userId }).exec();
      if (!user) {
        return {
          status: false,
          type: 1,
          oldpassword: UserMessage.INVALID_ACCOUNT,
        };
      }

      const isMatch = bcrypt.compareSync(body.oldpassword, user.password);
      if (!isMatch) {
        return {
          status: false,
          type: 1,
          oldpassword: UserMessage.CURRENT_PASSWORD_INCORRECT,
        };
      }

      const hash = bcrypt.hashSync(
        body.newpassword,
        bcrypt.genSaltSync(BCRYPT_SALT_ROUNDS),
      );
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
          return { status: true, msg: UserMessage.UPDATE_PASSWORD_SUCCESS };
        } else {
          return { status: false, msg: UserMessage.UPDATE_PASSWORD_FAILED };
        }
      }
    }

    return { status: false, msg: UserMessage.NO_DATA_TO_UPDATE };
  }

  async getFavorite(userId: string, query: any) {
    let page = 1;
    if (query.page) {
      page = parseInt(query.page, 10);
    }
    const skip = (page - 1) * this.limit;

    const user = await this.userModel
      .findById(userId)
      .select({ favorite: 1 })
      .lean()
      .exec();
    if (!user) {
      return { data: [], pageNext: 1 };
    }

    const posts = await firstValueFrom(
      this.postServiceClient.send(
        { cmd: CMD_GET_POSTS_BY_IDS },
        { ids: user.favorite, skip, limit: this.limit },
      ),
    ).catch(() => []);

    const pageNext = posts.length === this.limit ? page + 1 : null;
    return { data: posts || [], pageNext };
  }

  async saveFavorite(userId: string, body: any) {
    const { id } = body;

    if (!id) {
      return { status: false, msg: UserMessage.POST_NOT_FOUND };
    }

    const count = await firstValueFrom(
      this.postServiceClient.send({ cmd: CMD_CHECK_POST_EXISTS }, id),
    ).catch(() => 0);
    if (!count) {
      return { status: false, msg: UserMessage.POST_NOT_FOUND };
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return { status: false, msg: UserMessage.POST_NOT_FOUND };
    }

    if (user.favorite.indexOf(id.toString()) < 0) {
      try {
        await this.userModel.updateOne(
          { _id: userId },
          { $push: { favorite: id } },
        );
        return { status: true, msg: UserMessage.SAVE_FAVORITE_SUCCESS };
      } catch (err) {
        return { status: false, msg: UserMessage.POST_NOT_FOUND };
      }
    } else {
      return {
        status: false,
        msg: UserMessage.FAVORITE_ALREADY_EXISTS,
      };
    }
  }

  async unSaveFavorite(userId: string, body: any) {
    const { id } = body;

    if (!id) {
      return { status: false, msg: UserMessage.POST_NOT_FOUND };
    }

    const count = await firstValueFrom(
      this.postServiceClient.send({ cmd: CMD_CHECK_POST_EXISTS }, id),
    ).catch(() => 0);
    if (!count) {
      return { status: false, msg: UserMessage.POST_NOT_FOUND };
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return { status: false, msg: UserMessage.POST_NOT_FOUND };
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
        return { status: true, msg: UserMessage.UNSAVE_FAVORITE_SUCCESS };
      } catch (err) {
        return { status: false, msg: UserMessage.POST_NOT_FOUND };
      }
    } else {
      return {
        status: false,
        msg: UserMessage.FAVORITE_NOT_FOUND,
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
      return { status: false, msg: UserMessage.OPERATION_FAILED };
    }
  }

  async getSearch(userId: string, query: any) {
    let page = 1;
    if (query.page) {
      page = parseInt(query.page, 10);
    }
    const skip = (page - 1) * this.limit;
    const pageNext = page + 1;

    const results = await this.userModel
      .aggregate([
        { $match: { _id: userId } },
        { $project: { search: 1 } },
        { $unwind: '$search' },
        { $skip: skip },
        { $limit: this.limit },
        { $project: { _id: 0, search: 1 } },
      ])
      .exec();

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
      return { status: false, msg: UserMessage.POST_NOT_FOUND };
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
      return { status: true, msg: UserMessage.SAVE_SEARCH_SUCCESS };
    } else {
      return {
        status: false,
        msg: UserMessage.SAVE_SEARCH_FAILED,
      };
    }
  }

  async unSaveSearch(userId: string, body: any) {
    const { id } = body;

    if (!id) {
      return { status: false, msg: UserMessage.OPERATION_FAILED };
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
      return { status: true, msg: UserMessage.UNSAVE_SEARCH_SUCCESS };
    } else {
      return { status: false, msg: UserMessage.OPERATION_FAILED };
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
      return { status: false, msg: UserMessage.OPERATION_FAILED };
    }
  }
}
