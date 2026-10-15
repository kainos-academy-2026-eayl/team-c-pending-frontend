import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ESLint } from 'eslint'

test('lint accepts valid TypeScript', async () => {
  const eslint = new ESLint()
  const [result] = await eslint.lintText('export const value: number = 42', {
    filePath: 'src/lint-regression.ts',
  })

  assert.equal(result?.errorCount, 0)
  assert.equal(result?.warningCount, 0)
})

test('lint reports unused TypeScript variables', async () => {
  const eslint = new ESLint()
  const [result] = await eslint.lintText('const unused: number = 42', {
    filePath: 'src/lint-regression.ts',
  })

  assert.equal(result?.errorCount, 1)
  assert.equal(result?.messages[0]?.ruleId, '@typescript-eslint/no-unused-vars')
})
