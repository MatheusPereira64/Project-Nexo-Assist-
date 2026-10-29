import { textOverlap } from "@/domain/policy";
import { listArticles } from "@/db/repository";

export type ArticleHit = { id: string; title: string; body: string; score: number };

export function searchHelp(query: string): ArticleHit[] {
  return listArticles()
    .map((article) => ({
      id: article.id,
      title: article.title,
      body: article.body,
      score: Math.max(textOverlap(query, `${article.title} ${article.keywords}`), textOverlap(query, article.body)),
    }))
    .filter((article) => article.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
