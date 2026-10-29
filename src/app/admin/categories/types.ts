export type Category = {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
};
