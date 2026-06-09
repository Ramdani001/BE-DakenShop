import { PrismaClient } from '../../prisma/client';


const prisma = new PrismaClient();

export class DashboardService {

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    try {

      const salesRaw = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: 'COMPLETED',
        },
        select: {
          createdAt: true,
          totalAmount: true,
        },
      });

        const salesDataMap: { [key: string]: number } = {};
        salesRaw.forEach(order => {
        const dateKey = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        
        const amount = order.totalAmount && typeof order.totalAmount === 'object' && 'toNumber' in order.totalAmount
            ? (order.totalAmount as any).toNumber()
            : Number(order.totalAmount || 0);

        salesDataMap[dateKey] = (salesDataMap[dateKey] || 0) + amount;
        });

      const salesData = Object.keys(salesDataMap)
        .map((key) => ({
          name: key,
          sales: salesDataMap[key],
        }))

        .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

      const usersRaw = await prisma.user.findMany({
        where: {
          role: { not: 'ADMIN' },
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: { createdAt: true },
      });

      const monthsName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const userChartMap: { [key: string]: number } = {};
      
      userChartMap[monthsName[now.getMonth()]] = 0;

      usersRaw.forEach((user) => {
        const mName = monthsName[new Date(user.createdAt).getMonth()];
        if (userChartMap[mName] !== undefined) {
          userChartMap[mName]++;
        }
      });

      const userData = Object.keys(userChartMap).map((key) => ({
        month: key,
        users: userChartMap[key],
      }));

      const totalProducts = await prisma.product.count();
      const totalCategories = await prisma.category.count();
      
      const pendingOrders = await prisma.order.count({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      const topProductsGrouped = await prisma.orderItem.groupBy({
        by: ['productName'],
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 4,
      });

      const colors = ['#F59E0B', '#3B82F6', '#6366F1', '#10B981'];
      const productData = topProductsGrouped.map((item, index) => ({
        name: item.productName,
        value: item._sum.quantity || 0,
        color: colors[index] || '#94A3B8',
      }));


      return {
        salesData: salesData.length > 0 ? salesData : [{ name: 'No Data', sales: 0 }],
        userData,
        productData: productData.length > 0 ? productData : [{ name: 'No Sales', value: 1, color: '#94A3B8' }],
        quickStats: {
          totalProducts: totalProducts.toLocaleString(),
          activeCategories: totalCategories.toLocaleString(),
          activePromos: "0",
          pendingOrders: pendingOrders.toLocaleString(),
        },
      };

    } catch (error) {
      console.error('Error pada DashboardService:', error);
      throw new Error('Gagal memproses kalkulasi data statistik dashboard.');
    }
  }
}