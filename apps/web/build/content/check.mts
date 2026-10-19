import { contentDefinitions } from '../collections'
import { readContent } from './compiler'
export async function checkContent() {
  let documents = 0
  for (const definition of contentDefinitions)
    documents += (await readContent(definition)).documents.length
  return documents
}
