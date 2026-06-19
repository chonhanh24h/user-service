import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from '../schemas/user.schema';
import { Post } from '../schemas/post.schema';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: any;
  let mockPostModel: any;

  beforeEach(async () => {
    // Mock user model
    const mockUserDoc = {
      _id: 'userId1',
      favorite: ['postId1', 'postId2'],
      password: '$2a$10$hashedpassword',
      search: [
        { _id: 'search1', title: 'Search 1', url: '/search?q=1' },
      ],
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

    // Create a mock countDocuments that returns a chainable object with exec()
    const mockCountDocuments = jest.fn();
    mockPostModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: mockCountDocuments,
      bulkWrite: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Post.name),
          useValue: mockPostModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('myAdsAnalytic', () => {
    it('should return zero analytics when no posts found', async () => {
      mockPostModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.myAdsAnalytic('userId1');

      expect(result).toEqual({
        block: 0, post: 0, wait: 0, done: 0, cancel: 0,
      });
      expect(mockPostModel.find).toHaveBeenCalledWith({ userID: 'userId1' });
    });

    it('should count posts by status correctly', async () => {
      const mockPosts = [
        { status: 0 }, { status: 0 }, // block
        { status: 2 }, { status: 2 }, { status: 2 }, // post
        { status: 1 }, // wait
        { status: 3 }, { status: 3 }, // done
        { status: 4 }, // cancel
      ];

      mockPostModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPosts),
          }),
        }),
      });

      const result = await service.myAdsAnalytic('userId1');

      expect(result).toEqual({
        block: 2, post: 3, wait: 1, done: 2, cancel: 1,
      });
    });
  });

  describe('myAdsDetails', () => {
    it('should return paginated posts with default page', async () => {
      const mockPosts = [{ title: 'Post 1' }, { title: 'Post 2' }];
      mockPostModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(mockPosts),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.myAdsDetails('userId1', {});

      expect(result).toEqual({
        data: mockPosts,
        pageNext: 2,
        userID: 'userId1',
      });
    });

    it('should filter by type when query.type is provided', async () => {
      const mockPosts = [{ title: 'Post 1', status: 2 }];
      mockPostModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(mockPosts),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.myAdsDetails('userId1', { type: '2', page: '2' });

      expect(result).toEqual({
        data: mockPosts,
        pageNext: 3,
        userID: 'userId1',
      });
    });

    it('should return empty array when posts is null', async () => {
      mockPostModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(null),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.myAdsDetails('userId1', {});

      expect(result).toEqual({
        data: [],
        pageNext: 2,
        userID: 'userId1',
      });
    });
  });

  describe('myAdsUpdateStatus', () => {
    it('should throw error when id or type is missing', async () => {
      await expect(
        service.myAdsUpdateStatus('userId1', {}),
      ).rejects.toThrow(HttpException);

      await expect(
        service.myAdsUpdateStatus('userId1', { id: 'post1' }),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error when post not found', async () => {
      mockPostModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.myAdsUpdateStatus('userId1', { id: 'post1', type: '3' }),
      ).rejects.toThrow(
        new HttpException(
          { status: false, msg: 'Không tìm thấy tin đăng phù hợp!' },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should update post status and return old_status', async () => {
      const mockPost = {
        _id: 'post1',
        status: 2,
        save: jest.fn().mockResolvedValue(true),
      };

      mockPostModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPost),
        }),
      });

      const result = await service.myAdsUpdateStatus('userId1', { id: 'post1', type: '3' });

      expect(result).toEqual({ status: true, old_status: 3 });
      expect(mockPost.status).toBe(3);
      expect(mockPost.save).toHaveBeenCalled();
    });

    it('should throw error when save fails', async () => {
      const mockPost = {
        _id: 'post1',
        status: 2,
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      };

      mockPostModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPost),
        }),
      });

      await expect(
        service.myAdsUpdateStatus('userId1', { id: 'post1', type: '3' }),
      ).rejects.toThrow(
        new HttpException(
          { status: false, msg: 'Cập nhật trạng thái thất bại!' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
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
      const mockPosts = Array.from({ length: 10 }, (_, i) => ({ title: `Post ${i + 1}` }));

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockUser),
          }),
        }),
      });
      mockPostModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(mockPosts),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getFavorite('userId1', { page: '1' });

      expect(result).toEqual({ data: mockPosts, pageNext: 2 });
    });

    it('should set pageNext to 1 when less results than limit', async () => {
      const mockUser = { favorite: ['postId1'] };
      const mockPosts = [{ title: 'Post 1' }];

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockUser),
          }),
        }),
      });
      mockPostModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(mockPosts),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await service.getFavorite('userId1', {});

      expect(result).toEqual({ data: mockPosts, pageNext: 1 });
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
      mockPostModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.saveFavorite('userId1', { id: 'post1' });

      expect(result).toEqual({
        status: false,
        msg: 'Không TÌM THẤY tin đăng phù hợp!',
      });
    });

    it('should add favorite when post exists and not already favorited', async () => {
      mockPostModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });
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
      mockPostModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });
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
      mockPostModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });
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