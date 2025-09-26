// 导入postgres客户端库，用于与PostgreSQL数据库交互
import postgres from 'postgres';
// 导入数据类型定义
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
// 导入工具函数，用于格式化货币
import { formatCurrency } from './utils';

// 初始化PostgreSQL连接，使用环境变量中的数据库URL
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * 获取所有收入数据
 * @returns {Promise<Revenue[]>} 收入数据数组
 */
export async function fetchRevenue() {
  try {
    // 人为延迟响应的代码（用于演示目的）已被注释
    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    // 从revenue表中选择所有数据
    const data = await sql<Revenue[]>`SELECT * FROM revenue`;

    // console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

/**
 * 获取最近的5张发票
 * @returns {Promise<LatestInvoiceRaw[]>} 格式化后的最近发票数组
 */
export async function fetchLatestInvoices() {
  try {
    // 查询最近的5张发票，关联customers表获取客户信息
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    // 格式化发票金额
    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

/**
 * 获取仪表板卡片数据
 * @returns {Promise<Object>} 包含客户数量、发票数量、已付和待付发票总额的对象
 */
export async function fetchCardData() {
  try {
    // 并发执行多个SQL查询以提高性能
    // 1. 获取发票总数
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    // 2. 获取客户总数
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    // 3. 获取已付和待付发票的金额汇总
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    // 等待所有查询完成
    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    // 处理查询结果
    const numberOfInvoices = Number(data[0][0].count ?? '0');
    const numberOfCustomers = Number(data[1][0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

// 分页常量：每页显示的项目数
const ITEMS_PER_PAGE = 6;

/**
 * 根据查询条件和页码获取过滤后的发票数据
 * @param {string} query - 搜索查询字符串
 * @param {number} currentPage - 当前页码
 * @returns {Promise<InvoicesTable[]>} 过滤后的发票数据数组
 */
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  // 计算偏移量
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    // 根据查询条件搜索发票，支持按客户名称、电子邮件、金额、日期或状态搜索
    // 使用ILIKE进行不区分大小写的模糊匹配
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

/**
 * 获取符合查询条件的发票总页数
 * @param {string} query - 搜索查询字符串
 * @returns {Promise<number>} 总页数
 */
export async function fetchInvoicesPages(query: string) {
  try {
    // 计算符合查询条件的发票总数
    const data = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    // 计算总页数
    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

/**
 * 根据ID获取单个发票详情
 * @param {string} id - 发票ID
 * @returns {Promise<InvoiceForm>} 发票详情对象
 */
export async function fetchInvoiceById(id: string) {
  try {
    // 查询指定ID的发票
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    // 处理发票数据，将金额从分转换为元
    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

/**
 * 获取所有客户信息（仅包含ID和名称）
 * @returns {Promise<CustomerField[]>} 客户信息数组
 */
export async function fetchCustomers() {
  try {
    // 查询所有客户的ID和名称
    const customers = await sql<CustomerField[]>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

/**
 * 根据查询条件获取过滤后的客户数据，包含每个客户的发票统计信息
 * @param {string} query - 搜索查询字符串
 * @returns {Promise<CustomersTableType[]>} 过滤后的客户数据数组
 */
export async function fetchFilteredCustomers(query: string) {
  try {
    // 查询符合条件的客户，包含每个客户的发票数量、待付和已付金额
    const data = await sql<CustomersTableType[]>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    // 格式化货币字段
    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
