
import { GoogleGenAI, Type } from "@google/genai";
import { AIWordDetails, QuizQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 定义单词详情的响应结构
const wordDetailsSchema = {
  type: Type.OBJECT,
  properties: {
    definition: {
      type: Type.STRING,
      description: "简明易懂的英文定义，适合初中生水平。",
    },
    phonetic: {
      type: Type.STRING,
      description: "IPA 国际音标 (例如: /wɜːrd/)。",
    },
    chineseTranslation: {
      type: Type.STRING,
      description: "核心中文释义。",
    },
    exampleSentence: {
      type: Type.STRING,
      description: "一个贴近生活、难度适中的英文例句。",
    },
    synonyms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3个常用近义词。",
    },
  },
  required: ["definition", "phonetic", "chineseTranslation", "exampleSentence", "synonyms"],
};

export const getWordDetails = async (word: string): Promise<AIWordDetails | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `请为中国初中生解释单词 "${word}"。要求：音标准确，英文定义简单，中文翻译精准，例句地道且难度适中。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: wordDetailsSchema,
        systemInstruction: "你是一位专业、耐心且富有幽默感的初中英语老师。你的目标是让单词记忆变得轻松有趣。",
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as AIWordDetails;
    }
    return null;
  } catch (error) {
    console.error("Gemini 获取详情失败:", error);
    return null;
  }
};

/**
 * 从文本中提取重点词汇
 */
export const extractVocabularyFromText = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `以下是一段文档内容，请从中分析并提取出 15-20 个最适合初中生掌握、且具有一定学习难度的重点英文单词。请忽略超简单的基础词（如 the, is, happy 等）。文本内容：\n\n${text.substring(0, 10000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        systemInstruction: "你是一个资深的初中英语教研员，擅长从文章中精准捕捉核心考点词汇。",
      },
    });

    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error("文本词汇提取失败:", error);
    return [];
  }
};

/**
 * 生成选择题测验
 */
export const generateQuiz = async (words: string[]): Promise<QuizQuestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `请为以下单词生成中英对照的选择题（初中难度）：${words.join(', ')}。要求每个单词生成 1 道题，每道题有 4 个选项，干扰项应具有迷惑性。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              correctAnswer: { type: Type.STRING, description: "正确答案的中文含义" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "4个中文选项"
              },
              context: { type: Type.STRING, description: "简单的英文语境题干，例如: The ___ is beautiful." }
            },
            required: ["word", "correctAnswer", "options", "context"]
          }
        },
        systemInstruction: "你是一个专业的英语测试专家，擅长为初中生编写能够查漏补缺的选择题。",
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as QuizQuestion[];
    }
    return [];
  } catch (error) {
    console.error("测验生成失败:", error);
    return [];
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "请提取这张图片中出现的所有英文单词。只返回一个包含字符串的 JSON 数组。" },
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        systemInstruction: "你是一个专业的 OCR 文字识别助手。",
      },
    });
    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    return [];
  }
};
