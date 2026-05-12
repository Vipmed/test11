import { collection, query, getDocs, where, limit, Query, DocumentData } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { Question } from "@/src/constants";

/**
 * Service for optimized searching of questions across different bases.
 */
export const searchQuestions = async (
  searchTerm: string, 
  baseIds?: string[], 
  maxResults: number = 500
): Promise<Question[]> => {
  if (!searchTerm || searchTerm.trim().length === 0) return [];

  const searchLower = searchTerm.toLowerCase().trim();
  const results: Question[] = [];
  
  try {
    const questionsRef = collection(db, "questions");
    
    // If we have specific baseIds
    if (baseIds && baseIds.length > 0 && baseIds[0] !== 'all') {
      // Chunk baseIds into groups of 10 if necessary
      const chunks: string[][] = [];
      for (let i = 0; i < baseIds.length; i += 10) {
        chunks.push(baseIds.slice(i, i + 10));
      }
      
      const allFetched: Question[] = [];
      // Use for...of to avoid overwhelming the connection with too many parallel requests if chunks are many
      for (const chunk of chunks) {
        const q = query(questionsRef, where("baseId", "in", chunk), limit(1000));
        const snap = await getDocs(q);
        snap.forEach(doc => {
          allFetched.push({ ...(doc.data() as Question), id: doc.id });
        });
      }
      
      // Filter client-side
      for (const q of allFetched) {
        if (q.text.toLowerCase().includes(searchLower)) {
          results.push(q);
        }
        if (results.length >= maxResults) break;
      }
      
      return results;
    } else {
      // Global search - fetch a reasonable amount to search through
      const q = query(questionsRef, limit(1000));
      let snap;
      try {
        snap = await getDocs(q);
      } catch (err) {
        console.error("Firestore search fetch failed:", err);
        return [];
      }
      
      snap.forEach(doc => {
        const data = doc.data();
        // Robust check for required fields to prevent UI crashes
        if (data && data.text && typeof data.text === 'string') {
          if (data.text.toLowerCase().includes(searchLower)) {
            results.push({ ...(data as Question), id: doc.id });
          }
        }
      });
      
      return results.slice(0, maxResults);
    }
  } catch (error) {
    console.error("Search optimized error:", error);
    return [];
  }
};
