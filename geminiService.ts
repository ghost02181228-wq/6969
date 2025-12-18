
import { GoogleGenAI } from "@google/genai";
import { AppState } from './types';

/**
 * 分析財務數據並提供 AI 建議
 * 使用 gemini-3-pro-preview 並配置思考預算以獲得更深入的財務洞察
 */
export const analyzeFinances = async (state: AppState) => {
  // 必須直接從 process.env.API_KEY 獲取 API key，且不得向用戶詢問
  if (!process.env.API_KEY) {
    return "由於未設定 API 金鑰，無法提供 AI 財務建議。";
  }

  try {
    // 必須使用 new GoogleGenAI({ apiKey: process.env.API_KEY }) 直接傳入環境變數
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const totalIncome = state.transactions
      .filter(t => t.type === '收入')
      .reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = state.transactions
      .filter(t => t.type === '支出')
      .reduce((acc, t) => acc + t.amount, 0);

    const prompt = `
      身為一位專業的財務顧問，請根據以下使用者的財務數據給予建議：
      
      總帳戶餘額：${state.accounts.reduce((sum, acc) => sum + acc.balance, 0)} 元
      本期總收入：${totalIncome} 元
      本期總支出：${totalExpense} 元
      收支明細數量：${state.transactions.length} 筆
      分類概況：${state.categories.map(c => c.name).join(', ')}

      請提供：
      1. 財務現況摘要 (150字內)
      2. 具體的支出優化建議 (列點)
      3. 一句鼓勵使用的理財金句。
      
      請以繁體中文回答，並使用簡潔的 Markdown 格式。
    `;

    // 使用 gemini-3-pro-preview 進行複雜的理財分析
    // 啟用 Thinking Config 以獲得更精確的推理結果
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    // 獲取生成的文字內容，直接訪問 .text 屬性
    return response.text || "無法生成 AI 建議。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 服務暫時不可用，請稍後再試。";
  }
};
