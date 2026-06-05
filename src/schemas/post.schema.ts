import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: true })
export class Post {
  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop()
  name: string;

  @Prop({ default: 1 })
  user_type: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  userID: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' })
  categoryID: MongooseSchema.Types.ObjectId;

  @Prop()
  category: string;

  @Prop()
  category_alias: string;

  @Prop({ default: 1 })
  post_type: number;

  @Prop()
  title: string;

  @Prop()
  title_alias: string;

  @Prop()
  content: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ type: [String], default: [] })
  image: string[];

  @Prop({ default: true })
  has_thumb: boolean;

  @Prop()
  area: string;

  @Prop()
  area_alias: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'City' })
  areaID: MongooseSchema.Types.ObjectId;

  @Prop()
  city: string;

  @Prop()
  city_alias: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'City' })
  cityID: MongooseSchema.Types.ObjectId;

  @Prop()
  address: string;

  @Prop({ default: 1 })
  status: number;

  @Prop({ default: 1 })
  ads_type: number;

  @Prop()
  maker: string;

  @Prop()
  maker_alias: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' })
  makerID: MongooseSchema.Types.ObjectId;

  @Prop()
  series: string;

  @Prop()
  series_alias: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' })
  series_id: MongooseSchema.Types.ObjectId;

  @Prop()
  year: string;

  @Prop()
  km: string;

  @Prop()
  fuel: string;

  @Prop()
  gear: string;

  @Prop()
  seats: number;

  @Prop()
  door: number;

  @Prop()
  color: string;

  @Prop()
  number: string;

  @Prop()
  acreage: string;

  @Prop()
  bed_num: number;

  @Prop()
  wc_num: number;

  @Prop()
  floor_num: number;

  @Prop()
  num_floor: number;

  @Prop()
  direction: string;
}

export const PostSchema = SchemaFactory.createForClass(Post);