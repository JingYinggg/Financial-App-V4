import React, { useState, useMemo } from 'react';
import { useWealth } from '../context/WealthContext';
import {
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  Sliders,
  DollarSign,
  Copy,
  Link2,
  Info
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { YearSelector } from './YearSelector';

export const BalanceSheetView: React.FC = () => {
  const {
    balanceSheet,
    updateBalanceSheetCell,
    addBalanceSheetCategory,
    updateBalanceSheetCategory,
    deleteBalanceSheetCategory,
    addBalanceSheetYear,
    deleteBalanceSheetYear,
    cloneBalanceSheetYear,
    syncBalanceSheetFromTabs,
    annualReports,
    investmentReports,
    updateAnnualReport,
    addAnnualReport,
    updateInvestmentReport,
    addInvestmentReport,
    holdings,
    stockValuations,
    passiveAccounts,
    includedPrincipalAccountIds,
  } = useWealth();

  // Year filter for focused viewing or ALL years
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'tables' | 'charts'>('tables');

  // Share investment breakdown modal state (flowing directly from stock portfolio)
  const [shareBreakdownYear, setShareBreakdownYear] = useState<number | null>(null);

  // Inline editing for balance sheet cell
  const [editingCell, setEditingCell] = useState<{ itemId: string; year: string } | null>(null);
  const [cellInputVal, setCellInputVal] = useState<string>('');

  // Add category state
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'asset' | 'liability'>('asset');

  // Sync feedback
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Calculate live Share Investment values & stock breakdowns flowing directly from Stock Portfolio
  const stockPortfolioValuesByYear = useMemo(() => {
    const res: Record<string, { total: number; count: number; stocks: { name: string; code: string; market: string; value: number; currency: string; units?: number; price?: number }[] }> = {};
    
    balanceSheet.years.forEach(yr => {
      const yrValuations = stockValuations.filter(v => v.year === yr);
      const stocksList: { name: string; code: string; market: string; value: number; currency: string; units?: number; price?: number }[] = [];
      let yrTotal = 0;

      if (yrValuations.length > 0) {
        yrValuations.forEach(v => {
          const unitPrice = (v.endOfYearValue !== undefined && v.endOfYearValue > 0)
            ? v.endOfYearValue
            : (v.startOfYearValue || 0);

          const matchingHoldings = holdings.filter(h => 
            (v.code && h.code.toUpperCase() === v.code.toUpperCase()) || 
            h.name.toLowerCase() === v.stockName.toLowerCase()
          );
          const totalUnits = matchingHoldings.reduce((sum, h) => sum + h.units, 0);
          const effectiveUnits = totalUnits > 0 ? totalUnits : 1;
          const val = unitPrice * effectiveUnits;

          const isUSD = v.currency === 'USD' || v.market === 'US';
          const valInMYR = isUSD ? val * 4.45 : val;
          yrTotal += valInMYR;
          stocksList.push({
            name: v.stockName,
            code: v.code,
            market: v.market,
            value: val,
            currency: isUSD ? 'USD' : 'MYR',
            units: totalUnits > 0 ? totalUnits : undefined,
            price: unitPrice
          });
        });
      } else {
        // Derive from active holdings for current/recent year
        holdings.forEach(h => {
          const price = h.currentPrice ?? h.buyUnitPrice;
          const val = h.units * price;
          const isUSD = h.market === 'US';
          const valInMYR = isUSD ? val * 4.45 : val;
          yrTotal += valInMYR;
          stocksList.push({
            name: h.name,
            code: h.code,
            market: h.market,
            value: val,
            currency: isUSD ? 'USD' : 'MYR',
            units: h.units,
            price: price,
          });
        });
      }

      res[yr.toString()] = {
        total: yrTotal,
        count: stocksList.length,
        stocks: stocksList,
      };
    });

    return res;
  }, [balanceSheet.years, stockValuations, holdings]);

  // Formatting helpers
  const formatRM = (val: number | undefined) => {
    const num = Number(val) || 0;
    if (num < 0) {
      return `(RM ${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `RM ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatUSD = (val: number | undefined) => {
    const num = Number(val) || 0;
    if (num < 0) {
      return `($ ${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (val: number | undefined) => {
    const num = Number(val) || 0;
    return `${num >= 0 ? '' : ''}${num.toFixed(2)}%`;
  };

  // Sort years in descending order (2026, 2025, 2024, 2023) as in Attachment 0
  const displayedYears = useMemo(() => {
    const yrs = [...balanceSheet.years].sort((a, b) => b - a);
    if (selectedYear !== 'ALL') {
      return yrs.filter(y => y === selectedYear);
    }
    return yrs;
  }, [balanceSheet.years, selectedYear]);

  // Calculate dynamic ASNB values per year flowing from sum of ASM 1, ASM 2, and ASM 3 Dec principal
  const asnbValuesByYear = useMemo(() => {
    const res: Record<string, number> = {};
    const asmAccounts = passiveAccounts.filter(p => {
      const name = p.name.toUpperCase();
      return name.includes('ASM') || p.category === 'ASNB';
    });

    balanceSheet.years.forEach(yr => {
      const yrStr = yr.toString();
      let totalDecPrincipal = 0;
      let hasData = false;

      asmAccounts.forEach(account => {
        const decData = account.yearlyData?.[yrStr]?.['Dec'];
        if (decData && decData.principal !== undefined && decData.principal > 0) {
          totalDecPrincipal += decData.principal;
          hasData = true;
        } else if (account.principalAmount && account.principalAmount > 0) {
          // If no specific yearly Dec override is present, fallback to account principalAmount
          totalDecPrincipal += account.principalAmount;
          hasData = true;
        }
      });

      if (hasData && totalDecPrincipal > 0) {
        res[yrStr] = totalDecPrincipal;
      }
    });

    return res;
  }, [balanceSheet.years, passiveAccounts]);

  // Asset and Liability items (Share Investment flows from Stock Portfolio, ASNB flows from ASM 1+2+3 Dec principal)
  const assetItems = useMemo(() => {
    return balanceSheet.items
      .filter(i => i.type === 'asset')
      .map(item => {
        const lowerName = item.name.toLowerCase();
        const isShareItem =
          item.id === 'bs_share' ||
          lowerName.includes('share investment') ||
          lowerName === 'share' ||
          lowerName.includes('stock portfolio');

        const isAsnbItem =
          item.id === 'bs_asnb' ||
          lowerName.includes('asnb') ||
          (lowerName.includes('asm') && !lowerName.includes('2') && !lowerName.includes('3'));

        if (isShareItem) {
          const updatedValues = { ...item.values };
          balanceSheet.years.forEach(yr => {
            const yrKey = yr.toString();
            const flowVal = stockPortfolioValuesByYear[yrKey]?.total;
            if (flowVal !== undefined && flowVal > 0) {
              updatedValues[yrKey] = flowVal;
            }
          });
          return {
            ...item,
            values: updatedValues,
            isPortfolioLinked: true,
          };
        }

        if (isAsnbItem) {
          const updatedValues = { ...item.values };
          balanceSheet.years.forEach(yr => {
            const yrKey = yr.toString();
            const flowVal = asnbValuesByYear[yrKey];
            if (flowVal !== undefined && flowVal > 0) {
              updatedValues[yrKey] = flowVal;
            }
          });
          return {
            ...item,
            values: updatedValues,
            isAsnbLinked: true,
          };
        }

        return item;
      });
  }, [balanceSheet.items, balanceSheet.years, stockPortfolioValuesByYear, asnbValuesByYear]);
  const liabilityItems = useMemo(
    () => balanceSheet.items.filter(i => i.type === 'liability'),
    [balanceSheet.items]
  );

  // Totals calculations per year
  const totalsByYear = useMemo(() => {
    const res: Record<string, { totalAssets: number; totalLiabilities: number; netWorth: number; debtRatio: number }> = {};
    balanceSheet.years.forEach(yr => {
      const yrKey = yr.toString();
      const assets = assetItems.reduce((sum, item) => sum + (Number(item.values[yrKey]) || 0), 0);
      const liabilities = liabilityItems.reduce((sum, item) => sum + (Number(item.values[yrKey]) || 0), 0);
      const netWorth = assets - liabilities;
      const debtRatio = assets > 0 ? liabilities / assets : 0;
      res[yrKey] = { totalAssets: assets, totalLiabilities: liabilities, netWorth, debtRatio };
    });
    return res;
  }, [balanceSheet.years, assetItems, liabilityItems]);

  // Debt Ratio Table Data (Sorted chronologically for table & charts)
  const debtRatioRows = useMemo(() => {
    return [...balanceSheet.years]
      .sort((a, b) => a - b)
      .map(yr => {
        const yrKey = yr.toString();
        const data = totalsByYear[yrKey] || { totalAssets: 0, totalLiabilities: 0, debtRatio: 0 };
        return {
          year: yr,
          totalAsset: data.totalAssets,
          totalLiabilities: data.totalLiabilities,
          debtRatio: data.debtRatio
        };
      });
  }, [balanceSheet.years, totalsByYear]);

  // Helper to calculate total Dec principal for a given year from Passive Income Ledger (strictly following user account selection)
  const getPassiveDecPrincipalForYear = (yr: number) => {
    const yrStr = yr.toString();
    let total = 0;
    let hasAnyData = false;

    // Filter passive accounts based on user selection in Cash Flow -> Passive Yield Accounts
    const targetAccounts = passiveAccounts.filter(a =>
      includedPrincipalAccountIds && includedPrincipalAccountIds.length > 0
        ? includedPrincipalAccountIds.includes(a.id)
        : true
    );

    targetAccounts.forEach(account => {
      const lower = account.name.toLowerCase().trim();
      const cat = (account.category || '').toLowerCase().trim();
      const id = (account.id || '').toLowerCase();

      const isNonStock =
        cat === 'asnb' ||
        cat === 'digital bank' ||
        cat === 'money market' ||
        cat === 'fixed deposit' ||
        id.startsWith('p_asm') ||
        id.startsWith('p_digibank') ||
        id.startsWith('p_kdi') ||
        id.startsWith('p_versa') ||
        lower.startsWith('asm') ||
        lower.includes('amanah saham') ||
        lower.includes('asnb') ||
        lower.includes('wawasan') ||
        lower.includes('digital bank') ||
        lower.includes('kdi') ||
        lower.includes('versa');

      const isUs = !isNonStock && (
        id === 'p_stock_us' ||
        cat === 'us stocks' ||
        cat === 'overseas stock' ||
        cat === 'us' ||
        lower === 'stock portfolio (us)' ||
        lower.includes('(us)') ||
        lower.includes('us stock') ||
        lower.includes('overseas stock') ||
        lower.includes('global stock')
      );

      const isMy = !isNonStock && !isUs && (
        id === 'p_stock' ||
        cat === 'stock principal' ||
        cat === 'my stock' ||
        cat === 'my stocks' ||
        cat === 'malaysia stock' ||
        lower === 'stock portfolio (my)' ||
        lower.includes('(my)') ||
        lower.includes('my stock') ||
        lower.includes('bursa stock') ||
        lower.includes('malaysia stock') ||
        (lower.includes('stock') && !lower.includes('us') && !lower.includes('overseas'))
      );

      // 1. Check explicit December principal from yearlyData
      const decPrincipal = account.yearlyData?.[yrStr]?.['Dec']?.principal;
      if (decPrincipal !== undefined && decPrincipal > 0) {
        total += decPrincipal;
        hasAnyData = true;
        return;
      }

      // 2. Check explicit December principal from years array
      const yrArray = account.years?.[yrStr];
      if (yrArray && Array.isArray(yrArray)) {
        const decItem = yrArray.find(d => d.month === 'Dec');
        if (decItem && typeof decItem.principal === 'number' && decItem.principal > 0) {
          total += decItem.principal;
          hasAnyData = true;
          return;
        }
      }

      // 3. Fallbacks for dynamic stock portfolio cost
      if (isMy) {
        const myHoldingsCost = holdings
          .filter(h => h.market === 'MY')
          .reduce((sum, h) => sum + h.units * h.buyUnitPrice, 0);
        if (myHoldingsCost > 0) {
          total += myHoldingsCost;
          hasAnyData = true;
        } else if (account.principalAmount > 0) {
          total += account.principalAmount;
          hasAnyData = true;
        }
      } else if (isUs) {
        const usHoldingsCost = holdings
          .filter(h => h.market === 'US')
          .reduce((sum, h) => sum + h.units * h.buyUnitPrice, 0);
        if (usHoldingsCost > 0) {
          total += usHoldingsCost;
          hasAnyData = true;
        } else if (account.principalAmount > 0) {
          total += account.principalAmount;
          hasAnyData = true;
        }
      } else {
        if (account.principalAmount && account.principalAmount > 0) {
          total += account.principalAmount;
          hasAnyData = true;
        }
      }
    });

    return { total, hasAnyData };
  };

  // Annual Yield Table Data (Sorted chronologically, auto-flowing from Passive Income Ledger Dec Principal)
  const sortedAnnualReports = useMemo(() => {
    const rawSorted = [...annualReports].sort((a, b) => a.year - b.year);
    return rawSorted.map((row, idx, arr) => {
      const { total: decPrincipal, hasAnyData } = getPassiveDecPrincipalForYear(row.year);
      const effectivePrincipal = hasAnyData && decPrincipal > 0 ? decPrincipal : row.principal;

      const prevRow = idx > 0 ? arr[idx - 1] : null;
      let prevEffectivePrincipal = prevRow?.principal || 0;
      if (prevRow) {
        const prevDec = getPassiveDecPrincipalForYear(prevRow.year);
        if (prevDec.hasAnyData && prevDec.total > 0) {
          prevEffectivePrincipal = prevDec.total;
        }
      }

      const growthP = prevEffectivePrincipal > 0
        ? ((effectivePrincipal - prevEffectivePrincipal) / prevEffectivePrincipal) * 100
        : row.growthPPercent;

      const prevPassive = prevRow ? prevRow.passiveIncome : 0;
      const growthPI = prevPassive > 0
        ? ((row.passiveIncome - prevPassive) / prevPassive) * 100
        : row.growthPIPercent;

      return {
        ...row,
        principal: effectivePrincipal,
        growthPPercent: growthP,
        growthPIPercent: growthPI,
      };
    });
  }, [annualReports, passiveAccounts, holdings, includedPrincipalAccountIds]);

  // Investment Yearly Reports (Sorted chronologically)
  const sortedInvestmentReports = useMemo(() => {
    return [...investmentReports].sort((a, b) => a.year - b.year);
  }, [investmentReports]);

  // Chart 1: Quick Assets Distribution Data
  const assetsDistributionData = useMemo(() => {
    return [...balanceSheet.years]
      .sort((a, b) => a - b)
      .map(yr => {
        const yrKey = yr.toString();
        const entry: Record<string, any> = { year: yr.toString() };
        assetItems.forEach(item => {
          entry[item.name] = Number(item.values[yrKey]) || 0;
        });
        return entry;
      });
  }, [balanceSheet.years, assetItems]);

  // Colors for Asset Distribution lines (Muji earthy palette: Cedar, Matcha, Terracotta, Plum, Slate, Ochre, Charcoal)
  const assetColors = ['#B86B30', '#567A54', '#C45444', '#7E5285', '#6B7A88', '#D49E3D', '#4A433D'];

  // Handle cell save
  const handleSaveCell = (itemId: string, year: string) => {
    const val = parseFloat(cellInputVal.replace(/[^0-9.-]+/g, '')) || 0;
    updateBalanceSheetCell(itemId, year, val);
    setEditingCell(null);
  };

  // Handle add category
  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    addBalanceSheetCategory(newCatName.trim(), newCatType);
    setNewCatName('');
    setIsAddCategoryOpen(false);
  };

  // Handle Sync from Tabs
  const handleSyncFromTabs = async () => {
    setSyncStatus('Syncing data from stocks, dividends & passive accounts...');
    await syncBalanceSheetFromTabs(selectedYear !== 'ALL' ? selectedYear : undefined);
    setSyncStatus('✓ Data synced successfully from all tabs!');
    setTimeout(() => setSyncStatus(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Year Selector & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE3D6] shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <YearSelector
            years={[...balanceSheet.years].sort((a, b) => a - b)}
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
            showAllOption={true}
            allLabel="All Years"
            label="Year"
            onAddYear={(yr, cloneFrom) => {
              if (cloneFrom) {
                cloneBalanceSheetYear(cloneFrom, yr);
              } else {
                addBalanceSheetYear(yr);
              }
            }}
            onDeleteYear={(yr) => {
              if (balanceSheet.years.length > 1) {
                deleteBalanceSheetYear(yr);
              }
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-[#EFE8DD] p-1 rounded-xl border border-[#E2DAD0]">
            <button
              onClick={() => setActiveTab('tables')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'tables'
                  ? 'bg-[#FAF8F5] text-[#8F4E1D] shadow-xs'
                  : 'text-[#6B635A] hover:text-[#2D2823]'
              }`}
            >
              Summary Tables
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'charts'
                  ? 'bg-[#FAF8F5] text-[#8F4E1D] shadow-xs'
                  : 'text-[#6B635A] hover:text-[#2D2823]'
              }`}
            >
              Visual Charts
            </button>
          </div>

          <button
            onClick={() => setIsAddCategoryOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#3D3731] text-[#FAF8F5] rounded-xl text-xs font-bold hover:bg-[#2A2520] transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Item</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="bg-[#EEF4EE] border border-[#D5E4D4] text-[#3D633C] text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-between animate-fadeIn">
          <span>{syncStatus}</span>
          <button onClick={() => setSyncStatus(null)} className="text-[#3D633C] hover:text-[#233F23]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 bg-[#2D2823]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#EAE3D6] p-5 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-[#2D2823]">Add Balance Sheet Item</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#5C544C] block mb-1">Item Name</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="e.g., Fixed Deposit, PRS"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E2DAD0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B86B30] text-[#2D2823]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C544C] block mb-1">Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCatType('asset')}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                      newCatType === 'asset'
                        ? 'bg-[#EEF4EE] text-[#3D633C] border-[#B9D5B8] ring-2 ring-[#567A54]/20'
                        : 'bg-white border-[#E2DAD0] text-[#6B635A]'
                    }`}
                  >
                    Asset
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatType('liability')}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                      newCatType === 'liability'
                        ? 'bg-[#FDF0EE] text-[#B54838] border-[#F5C2BC] ring-2 ring-[#B54838]/20'
                        : 'bg-white border-[#E2DAD0] text-[#6B635A]'
                    }`}
                  >
                    Liability
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddCategoryOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#6B635A] hover:bg-[#EFE8DD] rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 text-xs font-bold bg-[#B86B30] text-white rounded-xl hover:bg-[#9E5720]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MAIN VIEW CONTENT */}
      {activeTab === 'tables' ? (
        <div className="space-y-6">
          {/* 1. BALANCE SHEET Table */}
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#EAE3D6] shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAE3D6] flex items-center justify-between bg-[#F5F0E6]/50">
              <h2 className="text-sm font-extrabold text-[#2D2823] tracking-tight">
                BALANCE SHEET
              </h2>
              <span className="text-[11px] text-[#7A7268] font-medium">
                Double-click or select cell to edit values
              </span>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[75vh] no-scrollbar touch-scroll relative">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#F8F5EE] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  <tr className="border-b border-[#E6E0D3] text-[#5C544C] font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4 w-72 min-w-[200px] sticky left-0 top-0 z-30 bg-[#F8F5EE] border-r border-[#E6E0D3] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">Asset (Exclude PPE)</th>
                    {displayedYears.map(yr => (
                      <th key={yr} className="py-3 px-4 text-right min-w-[105px]">
                        {yr}
                      </th>
                    ))}
                    <th className="py-3 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE2] text-[#2D2823] font-medium bg-white">
                  {/* Asset Rows */}
                  {assetItems.map(item => {
                    const isLinked = (item as any).isPortfolioLinked || (item as any).isAsnbLinked;

                    return (
                      <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors group">
                        <td className="py-2.5 px-4 font-semibold text-[#2D2823] sticky left-0 z-10 bg-white group-hover:bg-[#FAF8F5] border-r border-[#EAE3D6] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[200px]">
                          <span>{item.name}</span>
                        </td>
                        {displayedYears.map(yr => {
                          const yrKey = yr.toString();
                          const val = item.values[yrKey] || 0;
                          const isEditing = editingCell?.itemId === item.id && editingCell?.year === yrKey;

                          return (
                            <td
                              key={yr}
                              className="py-2 px-4 text-right cursor-pointer min-w-[105px]"
                              onClick={() => {
                                if (!isEditing) {
                                  setEditingCell({ itemId: item.id, year: yrKey });
                                  setCellInputVal(val ? val.toString() : '0');
                                }
                              }}
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={cellInputVal}
                                  onChange={e => setCellInputVal(e.target.value)}
                                  onBlur={() => handleSaveCell(item.id, yrKey)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveCell(item.id, yrKey);
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className={`w-28 px-2 py-1 text-right text-xs bg-white border-2 ${isLinked ? 'border-[#7E22CE]' : 'border-[#B86B30]'} rounded-lg focus:outline-none shadow-xs font-mono font-bold text-[#2D2823]`}
                                />
                              ) : (
                                <div className="flex items-center justify-end">
                                  <span className={`font-mono font-bold ${isLinked ? 'text-[#7E22CE]' : 'text-[#2D2823] hover:text-[#B86B30] hover:underline'}`} title={isLinked ? 'Auto-linked from portfolio/accounts' : 'Click to edit'}>
                                    {val > 0 ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      <td className="py-2 px-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => deleteBalanceSheetCategory(item.id)}
                          className="text-[#8C8379] hover:text-[#B54838] p-1"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}

                  {/* Total Assets Row */}
                  <tr className="bg-[#F5F0E6] font-bold text-[#2D2823] border-t-2 border-b-2 border-[#E0D7C9]">
                    <td className="py-3 px-4 uppercase text-[11px] tracking-wider text-[#2D2823] sticky left-0 z-10 bg-[#F5F0E6] border-r border-[#E0D7C9] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[200px]">
                      Total Assets
                    </td>
                    {displayedYears.map(yr => {
                      const yrKey = yr.toString();
                      const tot = totalsByYear[yrKey]?.totalAssets || 0;
                      return (
                        <td key={yr} className="py-3 px-4 text-right font-mono text-xs font-extrabold text-[#2D2823] min-w-[105px]">
                          {tot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                    <td></td>
                  </tr>

                  {/* Liabilities Subheader */}
                  <tr className="bg-[#FAF8F5] text-[#7A7268] font-bold uppercase text-[10px] tracking-wider">
                    <td colSpan={displayedYears.length + 2} className="py-2 px-4 sticky left-0 z-10 bg-[#FAF8F5] border-r border-[#EAE3D6]">
                      Liabilities
                    </td>
                  </tr>

                  {/* Liability Rows */}
                  {liabilityItems.map(item => (
                    <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors group">
                      <td className="py-2.5 px-4 font-semibold text-[#2D2823] sticky left-0 z-10 bg-white group-hover:bg-[#FAF8F5] border-r border-[#EAE3D6] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[200px]">
                        {item.name}
                      </td>
                      {displayedYears.map(yr => {
                        const yrKey = yr.toString();
                        const val = item.values[yrKey] || 0;
                        const isEditing = editingCell?.itemId === item.id && editingCell?.year === yrKey;

                        return (
                          <td
                            key={yr}
                            className="py-2 px-4 text-right cursor-pointer min-w-[105px]"
                            onClick={() => {
                              if (!isEditing) {
                                setEditingCell({ itemId: item.id, year: yrKey });
                                setCellInputVal(val ? val.toString() : '0');
                              }
                            }}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                type="text"
                                value={cellInputVal}
                                onChange={e => setCellInputVal(e.target.value)}
                                onBlur={() => handleSaveCell(item.id, yrKey)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveCell(item.id, yrKey);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                className="w-28 px-2 py-1 text-right text-xs bg-white border-2 border-[#B86B30] rounded-lg focus:outline-none shadow-xs font-mono font-bold text-[#2D2823]"
                              />
                            ) : (
                              <span className="font-mono text-[#2D2823] hover:text-[#B86B30] hover:underline">
                                {val > 0 ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => deleteBalanceSheetCategory(item.id)}
                          className="text-[#8C8379] hover:text-[#B54838] p-1"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Total Liabilities Row */}
                  <tr className="bg-[#F5F0E6] font-bold text-[#2D2823] border-t-2 border-b-2 border-[#E0D7C9]">
                    <td className="py-3 px-4 uppercase text-[11px] tracking-wider text-[#2D2823] sticky left-0 z-10 bg-[#F5F0E6] border-r border-[#E0D7C9] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[200px]">
                      Total Liabilities
                    </td>
                    {displayedYears.map(yr => {
                      const yrKey = yr.toString();
                      const tot = totalsByYear[yrKey]?.totalLiabilities || 0;
                      return (
                        <td key={yr} className="py-3 px-4 text-right font-mono text-xs font-extrabold text-[#2D2823] min-w-[105px]">
                          {tot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                    <td></td>
                  </tr>

                  {/* Net Worth Row */}
                  <tr className="bg-[#EFE8DD] font-extrabold text-[#2D2823] border-t-2 border-b-2 border-[#D8CFC0]">
                    <td className="py-3.5 px-4 uppercase text-xs tracking-wider text-[#2D2823] sticky left-0 z-10 bg-[#EFE8DD] border-r border-[#D8CFC0] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[200px]">
                      Net Worth
                    </td>
                    {displayedYears.map(yr => {
                      const yrKey = yr.toString();
                      const nw = totalsByYear[yrKey]?.netWorth || 0;
                      return (
                        <td key={yr} className="py-3.5 px-4 text-right font-mono text-xs font-black min-w-[105px]">
                          {nw < 0 ? (
                            <span className="text-[#B54838]">
                              ({Math.abs(nw).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                          ) : (
                            <span className="text-[#3D633C]">
                              {nw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid of Remaining 3 Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. DEBT RATIO Table */}
            <div className="bg-[#FAF8F5] rounded-2xl border border-[#EAE3D6] shadow-xs overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-[#EAE3D6] bg-[#F5F0E6]/50">
                <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                  DEBT RATIO
                </h3>
              </div>
              <div className="overflow-x-auto no-scrollbar touch-scroll grow bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F5EE] border-b border-[#E6E0D3] text-[#5C544C] font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-4">YEAR</th>
                      <th className="py-2.5 px-4 text-right">Total Asset</th>
                      <th className="py-2.5 px-4 text-right">Total Liabilities</th>
                      <th className="py-2.5 px-4 text-right">Debt Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE2] font-medium text-[#2D2823]">
                    {debtRatioRows.map(row => (
                      <tr key={row.year} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-4 font-bold text-[#2D2823]">{row.year}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#7E22CE]" title="Auto-flowing from Total Assets">{formatUSD(row.totalAsset)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#7E22CE]" title="Auto-flowing from Total Liabilities">{formatUSD(row.totalLiabilities)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#8F4E1D]">
                          {row.debtRatio.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. INVESTMENT PERFORMANCE Table */}
            <div className="bg-[#FAF8F5] rounded-2xl border border-[#EAE3D6] shadow-xs overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-[#EAE3D6] bg-[#F5F0E6]/50">
                <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                  INVESTMENT PERFORMANCE
                </h3>
              </div>
              <div className="overflow-x-auto no-scrollbar touch-scroll grow bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F5EE] border-b border-[#E6E0D3] text-[#5C544C] font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-4">YEAR</th>
                      <th className="py-2.5 px-4 text-right">Investment</th>
                      <th className="py-2.5 px-4 text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE2] font-medium text-[#2D2823]">
                    {sortedInvestmentReports.map(row => (
                      <tr key={row.year} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-4 font-bold text-[#2D2823]">{row.year}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#7E22CE]" title="Auto-flowing from Stock Portfolio">{formatRM(row.investmentAmount)}</td>
                        <td className={`py-2.5 px-4 text-right font-mono font-bold ${
                          row.plPercent >= 0 ? 'text-[#3D633C]' : 'text-[#B54838]'
                        }`}>
                          {formatPercent(row.plPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. RETURN ON INVESTMENT & PORTFOLIO GROWTH Table */}
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#EAE3D6] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#EAE3D6] bg-[#F5F0E6]/50">
              <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                RETURN ON INVESTMENT & PORTFOLIO GROWTH
              </h3>
            </div>
            <div className="overflow-x-auto no-scrollbar touch-scroll bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F5EE] border-b border-[#E6E0D3] text-[#5C544C] font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-4">YEAR</th>
                    <th className="py-2.5 px-4 text-right">PRINCIPAL</th>
                    <th className="py-2.5 px-4 text-right">PASSIVE</th>
                    <th className="py-2.5 px-4 text-right">Annual Yield</th>
                    <th className="py-2.5 px-4 text-right">GROWTH (P)</th>
                    <th className="py-2.5 px-4 text-right">GROWTH (PI)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE2] font-medium text-[#2D2823]">
                  {sortedAnnualReports.map(row => {
                    const yieldPct = row.principal > 0 ? (row.passiveIncome / row.principal) * 100 : 0;
                    return (
                      <tr key={row.year} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-4 font-bold text-[#2D2823]">{row.year}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#2D2823]" title="Auto-flowing from Cash Flow > Passive Yield Accounts (Total Dec Principal)">{formatRM(row.principal)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#7E22CE]" title="Auto-flowing from Dividends & Passive Accounts">{formatRM(row.passiveIncome)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#8F4E1D]">
                          {yieldPct.toFixed(2)}%
                        </td>
                        <td className={`py-2.5 px-4 text-right font-mono font-bold ${
                          row.growthPPercent >= 0 ? 'text-[#3D633C]' : 'text-[#B54838]'
                        }`}>
                          {formatPercent(row.growthPPercent)}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-mono font-bold ${
                          row.growthPIPercent >= 0 ? 'text-[#3D633C]' : 'text-[#B54838]'
                        }`}>
                          {formatPercent(row.growthPIPercent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* VISUAL CHARTS (Aligned with Summary Tables) */
        <div className="space-y-6">
          {/* Chart 1: Balance Sheet Assets Distribution */}
          <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE3D6] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                Balance Sheet: Assets Distribution
              </h3>
              <div className="text-[10px] font-mono text-[#7A7268] font-bold">
                <span>(RM)</span>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={assetsDistributionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE4D8" />
                  <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#DFD7CA' }} tick={{ fontSize: 11, fill: '#6B635A' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={42}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#6B635A' }}
                  />
                  <Tooltip
                    formatter={(val: any) => [`RM ${Number(val).toLocaleString()}`, '']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E5DEC6', backgroundColor: '#FAF8F5', color: '#2D2823', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {assetItems.map((item, idx) => (
                    <Area
                      key={item.id}
                      type="monotone"
                      dataKey={item.name}
                      stackId="1"
                      stroke={assetColors[idx % assetColors.length]}
                      fill={assetColors[idx % assetColors.length]}
                      fillOpacity={0.65}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Debt Ratio & Annual Yield */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 2: Debt Ratio */}
            <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE3D6] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                  Debt Ratio
                </h3>
                <div className="flex items-center gap-3 text-[10px] font-mono text-[#7A7268] font-bold">
                  <span>Left: (RM)</span>
                  <span>Right: (Ratio)</span>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={debtRatioRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE4D8" />
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#DFD7CA' }} tick={{ fontSize: 11, fill: '#6B635A' }} />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#6B635A' }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 1.5]}
                      width={32}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#6B635A' }}
                    />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        name === 'Debt Ratio' ? Number(val).toFixed(2) : `RM ${Number(val).toLocaleString()}`,
                        name
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E5DEC6', backgroundColor: '#FAF8F5', color: '#2D2823', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar yAxisId="left" dataKey="totalAsset" name="Total Asset" fill="#B86B30" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="totalLiabilities" name="Total Liabilities" fill="#C45444" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="debtRatio" name="Debt Ratio" stroke="#567A54" strokeWidth={2.5} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Return on Investment */}
            <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE3D6] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                  Return on Investment
                </h3>
                <div className="text-[10px] font-mono text-[#7A7268] font-bold">
                  <span>(RM)</span>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={sortedAnnualReports.map(r => ({
                      year: r.year.toString(),
                      'Principal': r.principal,
                      'Passive Amount': r.passiveIncome
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE4D8" />
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#DFD7CA' }} tick={{ fontSize: 11, fill: '#6B635A' }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#6B635A' }}
                    />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        `RM ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        name
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E5DEC6', backgroundColor: '#FAF8F5', color: '#2D2823', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Principal" name="Principal (RM)" fill="#4A433D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Passive Amount" name="Passive Amount (RM)" fill="#567A54" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Portfolio Growth Metrics & Investment Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 4: Portfolio Growth Metrics (Line Chart for Passive Growth, Principal Growth, and Dividend Yield) */}
            <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE3D6] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                  Portfolio Growth Metrics
                </h3>
                <div className="text-[10px] font-mono text-[#7A7268] font-bold">
                  <span>(%)</span>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={sortedAnnualReports.map(r => ({
                      year: r.year.toString(),
                      'GROWTH (P) %': r.growthPPercent,
                      'GROWTH (PI) %': r.growthPIPercent,
                      'Dividend Yield %': r.principal > 0 ? (r.passiveIncome / r.principal) * 100 : 0
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE4D8" />
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#DFD7CA' }} tick={{ fontSize: 11, fill: '#6B635A' }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={38}
                      tickFormatter={v => `${v}`}
                      tick={{ fontSize: 11, fill: '#6B635A' }}
                    />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        `${Number(val).toFixed(2)}%`,
                        name
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E5DEC6', backgroundColor: '#FAF8F5', color: '#2D2823', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Line type="monotone" dataKey="GROWTH (P) %" name="Principal Growth %" stroke="#7E5285" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="GROWTH (PI) %" name="Passive Growth %" stroke="#C45444" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Dividend Yield %" name="Dividend Yield %" stroke="#D49E3D" strokeWidth={2.5} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5: Investment Performance */}
            <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE3D6] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#2D2823] tracking-tight">
                  Investment Performance
                </h3>
                <div className="flex items-center gap-3 text-[10px] font-mono text-[#7A7268] font-bold">
                  <span>Left: (RM)</span>
                  <span>Right: (%)</span>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={sortedInvestmentReports.map(r => ({
                      year: r.year.toString(),
                      Investment: r.investmentAmount,
                      'P/L %': r.plPercent
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE4D8" />
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#DFD7CA' }} tick={{ fontSize: 11, fill: '#6B635A' }} />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#6B635A' }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      width={38}
                      tickFormatter={v => `${v}`}
                      tick={{ fontSize: 11, fill: '#6B635A' }}
                    />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        name.includes('%') ? `${Number(val).toFixed(2)}%` : `RM ${Number(val).toLocaleString()}`,
                        name
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E5DEC6', backgroundColor: '#FAF8F5', color: '#2D2823', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar yAxisId="left" dataKey="Investment" fill="#B86B30" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="P/L %" stroke="#567A54" strokeWidth={2.5} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Investment Details Breakdown Modal (Flows directly from Stock Portfolio) */}
      {shareBreakdownYear !== null && (
        <div className="fixed inset-0 bg-[#2D2823]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#EAE3D6] p-5 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE3D6] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#F1E9DC] text-[#854E20] rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#2D2823] flex items-center gap-2">
                    <span>Share Investment Breakdown</span>
                    <span className="text-xs bg-[#EFE8DD] text-[#8F4E1D] font-bold px-2 py-0.5 rounded-md border border-[#E2DAD0]">
                      {shareBreakdownYear}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#7A7268] flex items-center gap-1 mt-0.5">
                    <Check className="w-3 h-3 text-[#3D633C]" />
                    <span>Flows directly from your Stock Portfolio tab</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareBreakdownYear(null)}
                className="text-[#8C8379] hover:text-[#2D2823] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Year Selector Tabs inside modal */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#EAE3D6]">
              <span className="text-[10px] font-bold text-[#8C8379] uppercase tracking-wider mr-1">
                Year:
              </span>
              {displayedYears.map(yr => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setShareBreakdownYear(yr)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    shareBreakdownYear === yr
                      ? 'bg-[#B86B30] text-white shadow-xs'
                      : 'bg-[#EFE8DD] text-[#5C544C] hover:bg-[#E5DCD0]'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            {/* Content Table */}
            <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto rounded-xl border border-[#EAE3D6] bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F5EE] text-[11px] text-[#5C544C] uppercase tracking-wider font-bold border-b border-[#E6E0D3] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Stock / Asset</th>
                      <th className="py-2.5 px-2 text-center">Market</th>
                      <th className="py-2.5 px-3 text-right">Portfolio Value</th>
                      <th className="py-2.5 px-3 text-right">MYR Equivalent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE2] font-medium">
                    {(stockPortfolioValuesByYear[shareBreakdownYear.toString()]?.stocks || []).length > 0 ? (
                      stockPortfolioValuesByYear[shareBreakdownYear.toString()].stocks.map((stk, idx) => {
                        const isUSD = stk.currency === 'USD' || stk.market === 'US';
                        const myrVal = isUSD ? stk.value * 4.45 : stk.value;

                        return (
                          <tr key={idx} className="hover:bg-[#FAF8F5]">
                            <td className="py-2 px-3">
                              <div className="font-bold text-[#2D2823]">{stk.name}</div>
                              <div className="text-[10px] text-[#7A7268] font-mono">{stk.code}</div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  stk.market === 'MY'
                                    ? 'bg-[#EEF4EE] text-[#3D633C] border border-[#D5E4D4]'
                                    : stk.market === 'US'
                                    ? 'bg-[#EEF2F6] text-[#33557A] border border-[#D0DDEB]'
                                    : 'bg-[#FDF6ED] text-[#8F5A23] border border-[#F3E1CA]'
                                }`}
                              >
                                {stk.market}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[#2D2823] font-bold">
                              {stk.currency === 'USD' ? '$' : 'RM '}
                              {stk.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[#8F4E1D] font-extrabold">
                              RM {myrVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[#9E958C] text-xs">
                          No specific stock records logged for {shareBreakdownYear}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Row */}
              <div className="p-3 bg-[#F5F0E6] border border-[#E2DAD0] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F4E1D] block">
                    Total Share Investment ({shareBreakdownYear})
                  </span>
                  <span className="text-[11px] text-[#6B635A]">
                    Reflected directly in Balance Sheet Total Assets & Net Worth
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-base font-mono font-extrabold text-[#2D2823]">
                    RM {(stockPortfolioValuesByYear[shareBreakdownYear.toString()]?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#EAE3D6] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShareBreakdownYear(null)}
                className="px-4 py-1.5 bg-[#3D3731] hover:bg-[#2A2520] text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
