import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ default: 1 })
  permission: number;

  @Prop({ type: [String], default: [] })
  role: string[];

  @Prop({ type: [Object], default: [] })
  roleDetail: any[];

  @Prop()
  email: string;

  @Prop()
  password?: string;

  @Prop()
  phone: string;

  @Prop()
  name: string;

  @Prop()
  surname: string;

  @Prop()
  birthday: Date;

  @Prop({ default: 1 })
  gender: number;

  @Prop()
  province: string;

  @Prop()
  provinceID: string;

  @Prop()
  address: string;

  @Prop({ type: [String], default: [] })
  favorite: string[];

  @Prop({
    type: [
      {
        title: String,
        url: String,
      },
    ],
    default: [],
  })
  search: { title: string; url: string }[];

  @Prop({ default: 1 })
  user_type: number;

  @Prop({ default: 1 })
  status: number;

  @Prop()
  forgotToken: string;

  @Prop()
  forgotExpries: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);