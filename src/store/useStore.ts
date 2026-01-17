import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import Papa from 'papaparse';
import type { Participant, Winner, Prize, Settings } from '../lib/types';
import { drawWinners } from '../lib/lottery-logic';

interface LotteryState {
  participants: Participant[];
  winners: Winner[]; // 历史所有中奖记录
  prizes: Prize[];
  
  // 实时状态（用于多屏同步）
  currentPrizeId: string | null;
  isRolling: boolean;
  roundWinners: Participant[]; // 当前轮次已计算出的中奖者（等待展示）
  viewMode: 'welcome' | 'lottery' | 'prize';  // prize: 奖项展示页
  
  settings: Settings;
  
  // Actions
  importParticipants: (csvText: string, includeControlledFields?: boolean) => { success: boolean; count: number; error?: string };
  addPrize: (name: string, count: number) => void;
  updatePrize: (id: string, updates: Partial<Prize>) => void;
  removePrize: (id: string) => void;
  selectPrize: (id: string | null) => void;
  setViewMode: (mode: 'welcome' | 'lottery' | 'prize') => void;
  
  // 控制逻辑
  startRolling: () => void;
  stopRolling: () => void; // 执行抽奖算法，并更新 roundWinners

  resetWinners: () => void;
  fullReset: () => void;
  setSettings: (settings: Partial<Settings>) => void;
  // CRUD
  addParticipant: (p: Omit<Participant, 'id'>) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;
}

export const useLotteryStore = create<LotteryState>()(
  persist(
    (set, get) => ({
      participants: [],
      winners: [],
      prizes: [
        { id: '1', name: '三等奖', count: 5 },
        { id: '2', name: '二等奖', count: 3 },
        { id: '3', name: '一等奖', count: 1 },
      ],
      currentPrizeId: '1',
      isRolling: false,
      roundWinners: [],
      viewMode: 'welcome',
      
      settings: {
        title: 'Lucky Draw 2026',
        password: 'admin',
        welcomeTitle: '2026 NEW YEAR PARTY',
        welcomeSubtitle: '携手共进 · 再创辉煌',
        prizePageTitle: '今日奖项',
        logo: '',
      },

      importParticipants: (csvText: string, includeControlledFields: boolean = false) => {
        try {
          const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
          if (result.errors.length > 0) {
            return { success: false, count: 0, error: 'CSV解析错误: ' + result.errors[0].message };
          }

          const rawData = result.data as any[];
          const currentPrizes = get().prizes;
          const newParticipants: Participant[] = rawData.map((row: any) => {
            // 基础字段（始终读取）
            const participant: Participant = {
              id: nanoid(),
              name: row['姓名'] || row['name'] || 'Unknown',
              dept: row['部门'] || row['dept'] || '',
              mustWinPrizeId: null,
              banned: false,
              weight: 1,
            };

            // 受控字段：仅在解锁模式下读取
            if (includeControlledFields) {
              const prizeName = row['必中奖项(奖项名称)'] || row['必中奖项'] || row['mustWinPrize'];
              if (prizeName) {
                const prize = currentPrizes.find(p => p.name === prizeName);
                if (prize) participant.mustWinPrizeId = prize.id;
              }
              participant.banned = (row['禁止中奖(是/否)'] === '是' || row['banned'] === 'true');
              participant.weight = parseInt(row['权重(1-10)'] || row['weight'] || '1') || 1;
            }

            return participant;
          }).filter(p => p.name !== 'Unknown');

          set({ participants: newParticipants });
          return { success: true, count: newParticipants.length };
        } catch (e: any) {
          return { success: false, count: 0, error: e.message };
        }
      },

      addPrize: (name, count) => set(state => ({
        prizes: [...state.prizes, { id: nanoid(), name, count }]
      })),

      updatePrize: (id, updates) => set(state => ({
        prizes: state.prizes.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      removePrize: (id) => set(state => ({
        prizes: state.prizes.filter(p => p.id !== id),
        currentPrizeId: state.currentPrizeId === id ? null : state.currentPrizeId
      })),

      selectPrize: (id) => set({ currentPrizeId: id, roundWinners: [], isRolling: false }),

      setViewMode: (mode) => set({ viewMode: mode }),

      startRolling: () => set({ isRolling: true, roundWinners: [], viewMode: 'lottery' }),

      stopRolling: () => {
        const state = get();
        const { participants, winners, currentPrizeId, prizes } = state;
        
        if (!currentPrizeId) return;
        const currentPrize = prizes.find(p => p.id === currentPrizeId);
        if (!currentPrize) return;

        // 1. 排除历史已中奖
        const winnerIds = new Set(winners.map(w => w.id));
        // 2. 排除黑名单
        const validPool = participants.filter(p => !winnerIds.has(p.id) && !p.banned);
        // 3. 找出当前奖项的内定者
        const mustWinCandidates = participants.filter(p => 
            p.mustWinPrizeId === currentPrizeId && !winnerIds.has(p.id) && !p.banned
        );

        // 4. 执行算法
        // 确保 validPool 排除掉内定了其他奖项的人
        const finalPool = validPool.filter(p => !p.mustWinPrizeId || p.mustWinPrizeId === currentPrizeId);
        
        const newWinners = drawWinners(finalPool, currentPrize.count, mustWinCandidates);

        set({ 
          isRolling: false, 
          roundWinners: newWinners 
        });
        
        // 自动将本轮结果存入历史记录（防止刷新丢失）
        // 也可以选择在UI上手动确认。为了方便，这里直接存。
        // 但为了防止状态更新冲突，最好分开？ 
        // 考虑到用户体验，停止滚动即视为“结果已出”，应该立即持久化
        
        if (newWinners.length > 0) {
            const roundId = nanoid();
            const timestamp = Date.now();
            const winnersToAdd: Winner[] = newWinners.map(p => ({
                ...p,
                prizeId: currentPrizeId,
                roundId,
                wonAt: timestamp
            }));
            set(state => ({ winners: [...state.winners, ...winnersToAdd] }));
        }
      },

      resetWinners: () => set({ winners: [], roundWinners: [], isRolling: false }),
      
      fullReset: () => set({ participants: [], winners: [], prizes: [], roundWinners: [], isRolling: false }),

      setSettings: (newSettings) => set(state => ({ settings: { ...state.settings, ...newSettings } })),

      addParticipant: (p) => set(state => ({
        participants: [...state.participants, { ...p, id: nanoid() }]
      })),

      updateParticipant: (id, updates) => set(state => ({
        participants: state.participants.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      removeParticipant: (id) => set(state => ({
        participants: state.participants.filter(p => p.id !== id)
      }))
    }),
    {
      name: 'lucky-draw-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
