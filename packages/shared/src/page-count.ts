export type FilePageSelection = {
  selectedPagesAfterEdit: number;
  copies: number;
  pagesPerSheet?: number;
  duplex?: boolean;
};

export type PageUsage = {
  usedPages: number;
  maxPages: number;
  remainingPages: number;
  blocked: boolean;
  message?: string;
};

const toSheetCount = (file: FilePageSelection): number => {
  const pagesPerSheet = Math.max(1, file.pagesPerSheet ?? 1);
  const copyCount = Math.max(1, file.copies);
  const logicalSheets = Math.ceil(Math.max(0, file.selectedPagesAfterEdit) / pagesPerSheet);
  const duplexAdjustedSheets = file.duplex ? Math.ceil(logicalSheets / 2) : logicalSheets;

  return duplexAdjustedSheets * copyCount;
};

export const calculateOrderPrintPages = (files: FilePageSelection[]): number =>
  files.reduce((sum, file) => sum + toSheetCount(file), 0);

export const evaluatePageLimit = (
  files: FilePageSelection[],
  maxPagesPerOrder = 100,
): PageUsage => {
  const usedPages = calculateOrderPrintPages(files);
  const remainingPages = Math.max(0, maxPagesPerOrder - usedPages);
  const blocked = usedPages > maxPagesPerOrder;

  return {
    usedPages,
    maxPages: maxPagesPerOrder,
    remainingPages,
    blocked,
    message: blocked
      ? 'Max 100 pages per order. Remove pages, reduce copies, or split into two orders.'
      : undefined,
  };
};
