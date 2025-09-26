// 导入Revenue类型定义，用于类型检查
import { Revenue } from './definitions';

/**
 * 将金额从分转换为美元格式的字符串
 * @param {number} amount - 金额（以分为单位）
 * @returns {string} 格式化后的美元金额字符串
 */
export const formatCurrency = (amount: number) => {
  // 将金额除以100转换为美元，然后格式化为美国地区的货币格式
  return (amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
};

/**
 * 将日期字符串格式化为指定地区的本地日期格式
 * @param {string} dateStr - 日期字符串
 * @param {string} locale - 地区代码，默认为'en-US'（美国英语）
 * @returns {string} 格式化后的日期字符串
 */
export const formatDateToLocal = (
  dateStr: string,
  locale: string = 'en-US',
) => {
  // 将日期字符串转换为Date对象
  const date = new Date(dateStr);
  // 定义日期格式化选项
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  // 创建日期格式化器
  const formatter = new Intl.DateTimeFormat(locale, options);
  // 格式化日期并返回
  return formatter.format(date);
};

/**
 * 根据收入数据生成图表的Y轴标签和最大值
 * @param {Revenue[]} revenue - 收入数据数组
 * @returns {Object} 包含Y轴标签数组和最大标签值的对象
 */
export const generateYAxis = (revenue: Revenue[]) => {
  // 计算Y轴需要显示的标签
  // 基于最高收入记录，以1000为单位
  const yAxisLabels: string[] = [];
  // 找出最高收入记录
  const highestRecord = Math.max(...revenue.map((month) => month.revenue));
  // 计算最高标签值，向上取整到最近的1000
  const topLabel = Math.ceil(highestRecord / 1000) * 1000;

  // 从最高值开始，每次减少1000，生成Y轴标签
  for (let i = topLabel; i >= 0; i -= 1000) {
    yAxisLabels.push(`$${i / 1000}K`);
  }

  return { yAxisLabels, topLabel };
};

/**
 * 生成分页导航的页码数据
 * @param {number} currentPage - 当前页码
 * @param {number} totalPages - 总页数
 * @returns {(number|string)[]} 包含页码和省略符的数组
 */
export const generatePagination = (currentPage: number, totalPages: number) => {
  // 如果总页数小于等于7，显示所有页码，不使用省略符
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // 如果当前页在前3页，显示前3页、省略符和最后2页
  if (currentPage <= 3) {
    return [1, 2, 3, '...', totalPages - 1, totalPages];
  }

  // 如果当前页在后3页，显示前2页、省略符和最后3页
  if (currentPage >= totalPages - 2) {
    return [1, 2, '...', totalPages - 2, totalPages - 1, totalPages];
  }

  // 如果当前页在中间位置，显示第1页、省略符、当前页及其前后页、另一个省略符和最后1页
  return [
    1,
    '...',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    '...',
    totalPages,
  ];
};
