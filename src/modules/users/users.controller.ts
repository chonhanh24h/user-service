import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern({ cmd: 'put_my_info' })
  async putMyInfo(data: { userId: string; body: any }) {
    return this.usersService.putMyInfo(data.userId, data.body);
  }

  @MessagePattern({ cmd: 'get_profile' })
  async getMyInfo(data: { userId: string }) {
    return this.usersService.getMyInfo(data.userId);
  }

  @MessagePattern({ cmd: 'get_favorite' })
  async getFavorite(data: { userId: string; query: any }) {
    return this.usersService.getFavorite(data.userId, data.query);
  }

  @MessagePattern({ cmd: 'save_favorite' })
  async saveFavorite(data: { userId: string; body: any }) {
    return this.usersService.saveFavorite(data.userId, data.body);
  }

  @MessagePattern({ cmd: 'unsave_favorite' })
  async unSaveFavorite(data: { userId: string; body: any }) {
    return this.usersService.unSaveFavorite(data.userId, data.body);
  }

  @MessagePattern({ cmd: 'unsave_all_favorite' })
  async unSaveAllFavorite(data: { userId: string }) {
    return this.usersService.unSaveAllFavorite(data.userId);
  }

  @MessagePattern({ cmd: 'get_search' })
  async getSearch(data: { userId: string; query: any }) {
    return this.usersService.getSearch(data.userId, data.query);
  }

  @MessagePattern({ cmd: 'save_search' })
  async saveSearch(data: { userId: string; body: any }) {
    return this.usersService.saveSearch(data.userId, data.body);
  }

  @MessagePattern({ cmd: 'unsave_search' })
  async unSaveSearch(data: { userId: string; body: any }) {
    return this.usersService.unSaveSearch(data.userId, data.body);
  }

  @MessagePattern({ cmd: 'unsave_all_search' })
  async unSaveAllSearch(data: { userId: string }) {
    return this.usersService.unSaveAllSearch(data.userId);
  }
}
