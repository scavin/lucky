import type { Participant, Winner } from "./types";

/**
 * 核心抽奖算法
 * @param pool 当前候选池（已排除已中奖和黑名单）
 * @param count 本轮抽取数量
 * @param mustWinList 必中奖名单（未中奖的，且必须匹配当前奖项）
 */
export function drawWinners(
  pool: Participant[],
  count: number,
  mustWinList: Participant[]
): Participant[] {
  const winners: Participant[] = [];
  let remainingCount = count;

  // 1. 优先处理必中奖名单
  // 必须是“当前奖项”的内定者
  if (mustWinList.length > 0) {
    const mustWinCandidates = [...mustWinList];
    // Shuffle mustWin candidates
    for (let i = mustWinCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mustWinCandidates[i], mustWinCandidates[j]] = [mustWinCandidates[j], mustWinCandidates[i]];
    }

    // Take as many as needed
    const takeCount = Math.min(remainingCount, mustWinCandidates.length);
    for (let i = 0; i < takeCount; i++) {
      winners.push(mustWinCandidates[i]);
    }
    remainingCount -= takeCount;
  }

  // 2. 如果名额还没满，从普通池中按权重抽取
  if (remainingCount > 0) {
    // pool 应该已经排除了“内定其他奖项”的人（在外部 filter 逻辑中处理）
    // 同时也排除了步骤1中已中的人
    let candidates = pool.filter(p => !winners.some(w => w.id === p.id));

    // 权重处理：将权重 > 1 的人复制多份放入抽奖池 (简单加权算法)
    // 或者使用更高效的加权随机算法。考虑到年会人数通常 < 1000，简单复制即可。
    // 如果人数过大，可切换为累积概率算法。这里假设 < 5000 人。
    
    // 为了性能，我们采用 累积权重算法 (Weighted Random Selection)
    // 但为了混淆视听的“随机性”和逻辑简单，这里用简单的随机排序抽取即可，
    // 只有当有明确权重设置时才走加权。
    
    // 简单打乱
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // 加权抽取逻辑
    while (remainingCount > 0 && candidates.length > 0) {
        // 计算当前总权重
        const totalWeight = candidates.reduce((sum, p) => sum + (p.weight || 1), 0);
        let randomVal = Math.random() * totalWeight;
        
        let selectedIndex = -1;
        for (let i = 0; i < candidates.length; i++) {
            randomVal -= (candidates[i].weight || 1);
            if (randomVal <= 0) {
                selectedIndex = i;
                break;
            }
        }

        if (selectedIndex !== -1) {
            winners.push(candidates[selectedIndex]);
            // 移除已选，防止重复
            candidates.splice(selectedIndex, 1);
            remainingCount--;
        } else {
            // 防御性代码，万一没选中
            if (candidates.length > 0) {
                winners.push(candidates[0]);
                candidates.shift();
                remainingCount--;
            }
        }
    }
  }

  return winners;
}
