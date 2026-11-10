import { describe, expect, it } from "vitest"
import { finnaLessons, lessonHref, lessonVideo, lessonPoster } from "../finna-lessons"
import { fullFinnaLessons } from "../finna-lesson-content"
import { EDU_TOPIC_META } from "../education-content"
describe("shared FinnaCalc lesson metadata and Cloudflare media",()=>{
 it("keeps the lightweight card catalog in sync with the full articles",()=>{
  expect(finnaLessons).toEqual(fullFinnaLessons.map(({body,...metadata})=>metadata))
  expect(new Set(finnaLessons.map(l=>l.id)).size).toBe(finnaLessons.length)
 })
 it("links every lesson to a real topic, readable article and known video host",()=>{
  const topics=new Set(EDU_TOPIC_META.map(t=>t.id))
  for(const l of fullFinnaLessons){
   expect(topics.has(l.topic)).toBe(true);expect(l.body.length).toBeGreaterThan(0)
   expect(l.videoSeconds).toBeGreaterThan(0);expect(l.readMinutes).toBeGreaterThan(0)
   expect(lessonHref(l)).toBe(`/education/${l.topic}/${l.id}`)
   expect(new URL(lessonVideo(l)).host).toBe("pub-257565bd7835442abeca2beb3b572c1d.r2.dev")
   expect(lessonPoster(l)).toMatch(/\.jpg$/);expect(lessonVideo(l)).toMatch(/\.mp4$/)
  }
 })
})
