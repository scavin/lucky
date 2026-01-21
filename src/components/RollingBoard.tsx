import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLotteryStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import bgImg from "@/assets/bg.jpg";
import confetti from "canvas-confetti";
import { Maximize2, Settings } from "lucide-react";

interface RollingBoardProps {
  isRolling: boolean;
  candidates: { id: string; name: string; dept: string }[];
  currentWinners: { id: string; name: string; dept: string }[]; // 中奖者（定格显示）
}

// 混淆名字的生成器（用于滚动动画）- 仅姓名
const generateMockNames = (candidates: any[], count: number) => {
  if (candidates.length === 0) return Array(count).fill({ name: "???" });
  return Array.from({ length: count }).map(() => {
    return candidates[Math.floor(Math.random() * candidates.length)];
  });
};

export default function RollingBoard({ isRolling, candidates, currentWinners }: RollingBoardProps) {
  const [displayNames, setDisplayNames] = useState(generateMockNames(candidates, 12));
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef<'idle' | 'accelerating' | 'running' | 'decelerating'>('idle');
  const speedRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const candidatesRef = useRef(candidates);

  const { currentPrizeId, prizes, settings, viewMode } = useLotteryStore();
  const currentPrize = prizes.find(p => p.id === currentPrizeId);

  // 保持 candidates 引用最新
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  // 滚动动画逻辑（带加速和减速）
  useEffect(() => {
    const MIN_SPEED = 2;      // 初始速度：每秒2次
    const MAX_SPEED = 12;     // 最大速度：每秒12次（约83ms一次，肉眼可见）
    const ACCEL_DURATION = 1000;  // 加速时间：1秒
    const DECEL_DURATION = 1500;  // 减速时间：1.5秒

    if (isRolling && phaseRef.current === 'idle') {
      // 开始动画：进入加速阶段
      phaseRef.current = 'accelerating';
      setIsAnimating(true);
      speedRef.current = MIN_SPEED;
      lastUpdateRef.current = Date.now();

      const startTime = Date.now();
      let decelStartTime = 0;
      let decelStartSpeed = MAX_SPEED;

      const update = () => {
        const now = Date.now();

        // 根据当前阶段计算速度
        if (phaseRef.current === 'accelerating') {
          const elapsed = now - startTime;
          if (elapsed < ACCEL_DURATION) {
            // easeOut 加速曲线
            const progress = elapsed / ACCEL_DURATION;
            speedRef.current = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * (1 - Math.pow(1 - progress, 2));
          } else {
            phaseRef.current = 'running';
            speedRef.current = MAX_SPEED;
          }
        } else if (phaseRef.current === 'decelerating') {
          if (decelStartTime === 0) {
            decelStartTime = now;
            decelStartSpeed = speedRef.current;
          }
          const elapsed = now - decelStartTime;
          if (elapsed < DECEL_DURATION) {
            // easeOut 减速曲线
            const progress = elapsed / DECEL_DURATION;
            speedRef.current = decelStartSpeed * Math.pow(1 - progress, 2);
          } else {
            // 动画结束
            phaseRef.current = 'idle';
            setIsAnimating(false);
            cancelAnimationFrame(animationRef.current);
            return;
          }
        }

        // 根据当前速度决定是否更新名字
        const interval = 1000 / Math.max(speedRef.current, 0.5);
        if (now - lastUpdateRef.current >= interval) {
          setDisplayNames(generateMockNames(candidatesRef.current, 12));
          lastUpdateRef.current = now;
        }

        animationRef.current = requestAnimationFrame(update);
      };

      animationRef.current = requestAnimationFrame(update);
    } else if (!isRolling && (phaseRef.current === 'accelerating' || phaseRef.current === 'running')) {
      // 用户停止：进入减速阶段
      phaseRef.current = 'decelerating';
    }

    return () => {
      if (phaseRef.current === 'idle') {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRolling]);

  // 如果动画完全停止且有中奖者，显示中奖者
  const showWinners = !isAnimating && !isRolling && currentWinners.length > 0;
  const winnerNameClass =
    currentWinners.length > 40
      ? "text-lg md:text-xl"
      : currentWinners.length > 24
        ? "text-xl md:text-2xl"
        : currentWinners.length > 12
          ? "text-2xl md:text-3xl"
          : "text-4xl md:text-5xl";
  const winnerCardPadding =
    currentWinners.length > 40
      ? "p-4"
      : currentWinners.length > 24
        ? "p-5"
        : "p-8";
  const winnerCardMinWidth =
    currentWinners.length > 40
      ? 140
      : currentWinners.length > 24
        ? 160
        : 220;

  // 监听中奖展示，触发撒花特效
  useEffect(() => {
    if (showWinners) {
        // 从左右两侧发射礼花
        const end = Date.now() + 3000;
        const colors = ['#FFD700', '#FF4500', '#FFFFFF'];
        let animationId: number;

        (function frame() {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.8 },
                colors: colors
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.8 },
                colors: colors
            });

            if (Date.now() < end) {
                animationId = requestAnimationFrame(frame);
            }
        }());

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }
  }, [showWinners]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Background with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{ backgroundImage: `url(${bgImg})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Main Content */}
      <div className="z-10 w-full h-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          
          {/* 模式 1: 欢迎页 */}
          {viewMode === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center justify-center text-center p-8"
            >
              {settings.logo && (
                <motion.img
                  src={settings.logo}
                  alt="Logo"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="max-h-32 md:max-h-40 w-auto mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                />
              )}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-yellow-500/90 text-2xl md:text-4xl font-cinzel tracking-[0.5em] uppercase mb-6"
              >
                {settings.welcomeSubtitle || "Welcome"}
              </motion.h2>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-6xl md:text-9xl font-black text-white font-cinzel drop-shadow-[0_0_30px_rgba(255,215,0,0.6)] leading-tight"
              >
                {settings.welcomeTitle || "ANNUAL PARTY"}
              </motion.h1>
            </motion.div>
          )}

          {/* 模式 2: 奖项展示页 */}
          {viewMode === 'prize' && (
            <motion.div
              key="prize"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-7xl px-8 flex flex-col items-center"
            >
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-yellow-500 text-3xl md:text-5xl font-cinzel tracking-[0.3em] uppercase mb-12 drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]"
              >
                {settings.prizePageTitle || "今日奖项"}
              </motion.h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                {prizes.map((prize, idx) => (
                  <motion.div
                    key={prize.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1, type: "spring" }}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/30 to-red-900/40 blur-2xl rounded-3xl group-hover:blur-3xl transition-all" />
                    <div className="relative bg-black/60 backdrop-blur-md border-2 border-yellow-500/40 p-8 rounded-3xl flex flex-col items-center justify-center text-center hover:border-yellow-500/80 transition-all shadow-[0_0_40px_rgba(255,215,0,0.15)] min-h-[280px]">
                      <div className="text-4xl md:text-5xl font-bold text-white font-cinzel mb-3 drop-shadow-lg">{prize.name}</div>
                      <div className="text-yellow-400 text-2xl font-bold mb-4">× {prize.count} 名</div>
                      {prize.description && (
                        <div className="mt-4 pt-4 border-t-2 border-yellow-500/30 w-full">
                          <div className="text-yellow-100 text-xl md:text-2xl font-medium drop-shadow-md">
                            {prize.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 模式 3: 抽奖页 */}
          {viewMode === 'lottery' && (
            <motion.div
              key="lottery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-[90vw] px-4 flex flex-col items-center gap-8"
            >
              {/* Title / Prize Info */}
              <div className="text-center">
                <h2 className="text-gold-400 text-2xl md:text-3xl font-cinzel tracking-widest uppercase mb-2 text-yellow-500 drop-shadow-lg">
                  {settings.title}
                </h2>
                <h1 className="text-5xl md:text-7xl font-cinzel font-black text-white drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">
                  {currentPrize?.name || "Ready"}
                </h1>
                <div className="mt-4 flex items-center justify-center gap-2 text-white/80">
                  <span className="text-lg">本轮抽取: <span className="text-yellow-400 font-bold text-2xl">{currentPrize?.count}</span> 人</span>
                </div>
              </div>

              {/* Rolling Area / Winner Display */}
              <div className="w-full min-h-[400px] relative flex items-center justify-center perspective-1000">
                <AnimatePresence mode="wait">
                  {showWinners ? (
                    // Winner Display (Flex centered)
                    <motion.div
                      key="winners"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      className="grid gap-4 w-full"
                      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${winnerCardMinWidth}px, 1fr))` }}
                    >
                      {currentWinners.map((winner, idx) => (
                        <motion.div
                          key={winner.id}
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1, type: "spring" }}
                          className="relative group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 to-red-900/40 blur-xl rounded-full group-hover:blur-2xl transition-all" />
                          <div className={`relative bg-black/40 backdrop-blur-md border border-yellow-500/30 ${winnerCardPadding} rounded-xl flex flex-col items-center justify-center text-center hover:border-yellow-500/80 transition-all shadow-[0_0_30px_rgba(220,38,38,0.2)] min-h-[120px]`}>
                            {/* 仅显示名字，且加大字号 */}
                            <div className={`${winnerNameClass} font-bold text-white font-cinzel drop-shadow-md leading-tight break-words`}>{winner.name}</div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    // Rolling State
                    <motion.div 
                      key="rolling"
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full opacity-80"
                    >
                      {displayNames.slice(0, 12).map((item, i) => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-lg flex flex-col items-center justify-center min-h-[100px]">
                           <span className={cn(
                             "text-3xl font-bold text-white/90 font-mono transition-all duration-75",
                             isAnimating && "blur-[1px] scale-105"
                           )}>
                             {item.name}
                           </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {!isFullscreen && (
        <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-3">
          <button
            type="button"
            title="全屏显示"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen?.();
                return;
              }
              document.documentElement.requestFullscreen?.();
            }}
            className="h-10 w-10 rounded-full bg-white/10 text-white border border-white/20 backdrop-blur hover:bg-white/20 hover:border-white/40 flex items-center justify-center"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
          <a
            href="#/admin"
            title="进入后台管理"
            className="h-10 w-10 rounded-full bg-white/10 text-white border border-white/20 backdrop-blur hover:bg-white/20 hover:border-white/40 flex items-center justify-center"
          >
            <Settings className="h-5 w-5" />
          </a>
        </div>
      )}
    </div>
  );
}
