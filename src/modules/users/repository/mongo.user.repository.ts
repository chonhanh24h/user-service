import { Injectable } from '@nestjs/common';
import { FilterQuery, IUserRepository } from '../interface/user.interface';
import { User, UserDocument } from '../users.schema';
import { UpdateQuery, UpdateWriteOpResult } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class MongoUserRepository implements IUserRepository {
  constructor(@InjectModel(User.name) private model: Model<UserDocument>) {}

  findById(id: string): Promise<UserDocument | null> {
    return this.model.findById(id).exec();
  }
  updateOne(
    query: FilterQuery<UserDocument>,
    update: UpdateQuery<UserDocument>,
  ): Promise<UpdateWriteOpResult> {
    return this.model.updateOne(query, update).exec();
  }
  getSearch(id: string, query: any) {
    return this.model
      .aggregate([
        { $match: { _id: id } },
        { $project: { search: 1 } },
        { $unwind: '$search' },
        { $skip: query.skip },
        { $limit: query.limit },
        { $project: { _id: 0, search: 1 } },
      ])
      .exec();
  }
  saveSearch(id: string, search: { title: string; url: string }) {
    return this.model
      .updateOne(
        { _id: id },
        {
          $push: { search: search },
        },
      )
      .exec();
  }
  unSaveSearch(id: string, searchId: string) {
    return this.model
      .updateOne(
        { _id: id, 'search._id': searchId },
        { $pull: { search: { _id: searchId } } },
      )
      .exec();
  }
  unSaveAllSearch(id: string) {
    return this.model
      .updateOne({ _id: id, search: { $ne: [] } }, { $set: { search: [] } })
      .exec();
  }
  async getFavorite(id: string): Promise<string[]> {
    const user = await this.model
      .findById(id)
      .select({ favorite: 1 })
      .lean()
      .exec();
    return user?.favorite || [];
  }
  saveFavorite(id: string, favoriteId: string) {
    return this.model
      .updateOne({ _id: id }, { $push: { favorite: favoriteId } })
      .exec();
  }
  unSaveFavorite(id: string, newFavorite: string[]) {
    return this.model.updateOne({ _id: id }, { favorite: newFavorite }).exec();
  }
  unSaveAllFavorite(id: string) {
    return this.model
      .updateOne({ _id: id, favorite: { $ne: [] } }, { $set: { favorite: [] } })
      .exec();
  }
}
