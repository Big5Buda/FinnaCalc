import catalog from "./finna-lessons.json"
import type { FinnaLesson } from "./finna-lessons"
/** Full articles stay on server-rendered lesson routes, out of market-page client bundles. */
export const fullFinnaLessons = catalog as FinnaLesson[]
