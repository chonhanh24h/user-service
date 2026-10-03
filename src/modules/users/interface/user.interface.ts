export type FilterQuery<T> = {
  _id?: string;
  favorite?: any;
  search?: any;
};

// Nên định nghĩa các type hoặc interface của input hoặc output chứ không
// sử dụng các đối tượng của một thư viện cụ thể nào => thì nó mới tránh được việc
// ràng buộc vào công nghệ cụ thể.
// tạm thời để any để cho nhanh (thay đổi sau)

export interface IUserRepository {
  findById(id: string): Promise<any>;
  updateOne(query: FilterQuery<any>, update: any): Promise<any>;
  getSearch(id: string, query: any): Promise<any>;
  saveSearch(id: string, search: { title: string; url: string }): Promise<any>;
  unSaveSearch(id: string, query: any): Promise<any>;
  unSaveAllSearch(id: string): Promise<any>;
  getFavorite(id: string): Promise<any>;
  saveFavorite(id: string, favoriteId: string): Promise<any>;
  unSaveFavorite(id: string, newFavorite: string[]): Promise<any>;
  unSaveAllFavorite(id: string): Promise<any>;
}
