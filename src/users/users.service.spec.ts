import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from '../schemas/user.schema';
import { of } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: any;
  let mockPostServiceClient: any;

  beforeEach(async () => {
    // Mock user model
    const mockUserDoc = {
      _id: 'userId1',
      favorite: ['postId1', 'postId2'],
      password: '$2a$10$hashedpassword',
      search: [{ _id: 'search1', title: 'Search 1', url: '/search?q=1' }],
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
      bulkWrite: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockPostServiceClient = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: 'POST_SERVICE',
          useValue: mockPostServiceClient,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('putMyInfo', () => {
    it('should validate phone number', async () => {
      const result = await service.putMyInfo('userId1', {
        phone: '123',
        yourname: 'Test',
      });

      expect(result).toEqual({
        status: false,
        type: 1,
        phone: 'Số điện thoại không hợp lệ',
      });
    });

    it('should validate name length', async () => {
      const result = await service.putMyInfo('userId1', {
        phone: '0987654321',
        yourname: 'AB',
      });

      expect(result).toEqual({
        status: false,
        type: 1,
        yourname: 'Tên của bạn gồm 3-20 ký tự',
      });
    });

    it('should remove special characters from name', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.putMyInfo('userId1', {
        phone: '0987654321',
        yourname: 'Test!@#Name',
      });

      expect(mockUserModel.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: 'userId1' },
            update: { phone: '0987654321', name: 'TestName' },
          },
        },
      ]);
      expect(result).toEqual({
        status: true,
        msg: 'Cập nhật thông tin thành công!',
      });
    });

    it('should update password when all password fields are provided', async () => {
      const mockUser = {
        _id: 'userId1',
        password: '$2a$10$hashedpassword',
      };

      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(true);
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.putMyInfo('userId1', {
        oldpassword: 'oldpass123',
        newpassword: 'newpass123',
        repassword: 'newpass123',
      });

      expect(result).toEqual({
        status: true,
        msg: 'Cập nhật mật khẩu thành công!',
      });
    });

    it('should fail password update when old password does not match', async () => {
      const mockUser = {
        _id: 'userId1',
        password: '$2a$10$hashedpassword',
      };

      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(false);
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.putMyInfo('userId1', {
        oldpassword: 'wrongpass',
        newpassword: 'newpass123',
        repassword: 'newpass123',
      });

      expect(result).toEqual({
        status: false,
        type: 1,
        oldpassword: 'Mật khẩu hiện tại không chính xác!',
      });
    });

    it('should return no data message when no fields provided', async () => {
      const result = await service.putMyInfo('userId1', {});

      expect(result).toEqual({
        status: false,
        msg: 'Không có dữ liệu để cập nhật!',
      });
    });
  });

  describe('getFavorite', () => {
    it('should return empty data when user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const result = await service.getFavorite('userId1', {});

      expect(result).toEqual({ data: [], pageNext: 1 });
    });

    it('should return favorited posts with pagination', async () => {
      const mockUser = { favorite: ['postId1', 'postId2'] };
      // Create 10 posts to match the service limit for pageNext=2
      const mockPosts = Array.from({ length: 10 }, (_, i) => ({
        title: `Post ${i + 1}`,
      }));

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockUser),
          }),
        }),
      });
      mockPostServiceClient.send.mockReturnValue(of(mockPosts));

      const result = await service.getFavorite('userId1', { page: '1' });

      expect(result).toEqual({ data: mockPosts, pageNext: 2 });
    });

    it('should set pageNext to null when less results than limit', async () => {
      const mockUser = { favorite: ['postId1'] };
      const mockPosts = [{ title: 'Post 1' }];

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockUser),
          }),
        }),
      });
      mockPostServiceClient.send.mockReturnValue(of(mockPosts));

      const result = await service.getFavorite('userId1', {});

      expect(result).toEqual({ data: mockPosts, pageNext: null });
    });
  });

  describe('saveFavorite', () => {
    it('should return error when id is missing', async () => {
      const result = await service.saveFavorite('userId1', {});

      expect(result).toEqual({
        status: false,
        msg: 'Không TÌM THẤY tin đăng phù hợp!',
      });
    });

    it('should return error when post not found', async () => {
      mockPostServiceClient.send.mockReturnValue(of(0));

      const result = await service.saveFavorite('userId1', { id: 'post1' });

      expect(result).toEqual({
        status: false,
        msg: 'Không TÌM THẤY tin đăng phù hợp!',
      });
    });

    it('should add favorite when post exists and not already favorited', async () => {
      mockPostServiceClient.send.mockReturnValue(of(1));
      const mockUser = {
        _id: 'userId1',
        favorite: ['otherPostId'],
        save: jest.fn(),
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.saveFavorite('userId1', { id: 'post1' });

      expect(result).toEqual({
        status: true,
        msg: 'Đã LƯU vào danh sách yêu thích!',
      });
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: 'userId1' },
        { $push: { favorite: 'post1' } },
      );
    });

    it('should return error when post already in favorites', async () => {
      mockPostServiceClient.send.mockReturnValue(of(1));
      const mockUser = {
        _id: 'userId1',
        favorite: ['post1'],
        save: jest.fn(),
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.saveFavorite('userId1', { id: 'post1' });

      expect(result).toEqual({
        status: false,
        msg: 'Tin đăng ĐÃ TỒN TẠI trong danh sách yêu thích của bạn!',
      });
    });
  });

  describe('unSaveFavorite', () => {
    it('should return error when id is missing', async () => {
      const result = await service.unSaveFavorite('userId1', {});

      expect(result).toEqual({
        status: false,
        msg: 'Không TÌM THẤY tin đăng phù hợp!',
      });
    });

    it('should remove favorite when exists', async () => {
      mockPostServiceClient.send.mockReturnValue(of(1));
      const mockUser = {
        _id: 'userId1',
        favorite: ['post1', 'post2'],
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.unSaveFavorite('userId1', { id: 'post1' });

      expect(result).toEqual({
        status: true,
        msg: 'Đã XÓA khỏi danh sách yêu thích!',
      });
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: 'userId1' },
        { favorite: ['post2'] },
      );
    });
  });

  describe('unSaveAllFavorite', () => {
    it('should return success when favorites cleared', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.unSaveAllFavorite('userId1');

      expect(result).toEqual({ status: true });
    });

    it('should return failure when no documents modified', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 0 });

      const result = await service.unSaveAllFavorite('userId1');

      expect(result).toEqual({
        status: false,
        msg: 'Thực hiện thất bại. Vui lòng thử lại!',
      });
    });
  });

  describe('getSearch', () => {
    it('should return saved searches with pagination', async () => {
      const mockResults = [
        { search: { title: 'Search 1', url: '/search?q=1' } },
        { search: { title: 'Search 2', url: '/search?q=2' } },
      ];
      mockUserModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResults),
      });

      const result = await service.getSearch('userId1', { page: '1' });

      expect(result).toEqual({
        status: true,
        data: [
          { title: 'Search 1', url: '/search?q=1' },
          { title: 'Search 2', url: '/search?q=2' },
        ],
        pageNext: 2,
      });
    });

    it('should return status false when no results', async () => {
      mockUserModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getSearch('userId1', {});

      expect(result).toEqual({ status: false });
    });
  });

  describe('saveSearch', () => {
    it('should return error when url is missing', async () => {
      const result = await service.saveSearch('userId1', { title: 'Test' });

      expect(result).toEqual({
        status: false,
        msg: 'Không TÌM THẤY tin đăng phù hợp!',
      });
    });

    it('should save search with encoded title and cleaned URL', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.saveSearch('userId1', {
        url: '/search?category=1&page=2',
        title: 'Test & Search <3',
      });

      expect(mockUserModel.bulkWrite).toHaveBeenCalled();
      const bulkWriteCall = mockUserModel.bulkWrite.mock.calls[0];
      const updatePush = bulkWriteCall[0][0].updateOne.update.$push.search;
      expect(updatePush.url).toBe('/search?category=1&page=1');
      expect(updatePush.title).toContain('&');
      expect(result).toEqual({
        status: true,
        msg: 'Thành công! Bạn đã lưu tìm kiếm này.',
      });
    });

    it('should return failure when bulkWrite modifies 0 docs', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 0 });

      const result = await service.saveSearch('userId1', {
        url: '/search?q=1',
        title: 'Test Search',
      });

      expect(result).toEqual({
        status: false,
        msg: 'Lưu tìm kiếm thất bại. Vui lòng thử lại!',
      });
    });
  });

  describe('unSaveSearch', () => {
    it('should return error when id is missing', async () => {
      const result = await service.unSaveSearch('userId1', {});

      expect(result).toEqual({
        status: false,
        msg: 'Thực hiện thất bại. Vui lòng thử lại!',
      });
    });

    it('should remove search successfully', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.unSaveSearch('userId1', { id: 'search1' });

      expect(mockUserModel.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: 'userId1', 'search._id': 'search1' },
            update: { $pull: { search: { _id: 'search1' } } },
          },
        },
      ]);
      expect(result).toEqual({
        status: true,
        msg: 'Thành công! Tìm kiếm đã được hủy.',
      });
    });

    it('should return failure when no document was modified', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 0 });

      const result = await service.unSaveSearch('userId1', { id: 'search1' });

      expect(result).toEqual({
        status: false,
        msg: 'Thực hiện thất bại. Vui lòng thử lại!',
      });
    });
  });

  describe('unSaveAllSearch', () => {
    it('should clear all searches successfully', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.unSaveAllSearch('userId1');

      expect(result).toEqual({ status: true });
    });

    it('should return failure when no modifications', async () => {
      mockUserModel.bulkWrite.mockResolvedValue({ modifiedCount: 0 });

      const result = await service.unSaveAllSearch('userId1');

      expect(result).toEqual({
        status: false,
        msg: 'Thực hiện thất bại. Vui lòng thử lại!',
      });
    });
  });
});
