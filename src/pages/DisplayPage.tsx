import { useState, useEffect, useRef } from "react";
import { useLotteryStore } from "@/store/useStore";
import RollingBoard from "@/components/RollingBoard";
import { toast } from "sonner";

export default function DisplayPage() {
  const { 
    participants, currentPrizeId, prizes, isRolling, roundWinners, settings 
  } = useLotteryStore();

  // 本地用于状态判断的 ref
  const prevRollingRef = useRef(isRolling);

  // 强制轮询同步 localStorage (解决 file:// 协议下跨窗口不同步问题)
  useEffect(() => {
    const timer = setInterval(() => {
      useLotteryStore.persist.rehydrate();
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // 当前奖项信息
  const currentPrize = prizes.find(p => p.id === currentPrizeId);
  const candidates = participants.filter(p => !p.banned); 

  // 监听 Store 变化 (仅保留状态更新，不再播放音效)
  useEffect(() => {
    prevRollingRef.current = isRolling;
  }, [isRolling, roundWinners]);

  // 全局标题同步
  useEffect(() => {
    document.title = settings.title;
  }, [settings.title]);

  return (
    <div className="w-full h-screen overflow-hidden bg-black text-white font-sans">
      <RollingBoard 
        isRolling={isRolling} 
        candidates={candidates} 
        currentWinners={roundWinners} 
      />
    </div>
  );
}
