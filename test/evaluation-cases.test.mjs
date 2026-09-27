import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEvaluationFile} from '../lib/evaluation-cases.mjs';
const fixture=JSON.parse(await readFile(new URL('../examples/my-lens.json',import.meta.url),'utf8'));
test('evaluation selects development and held-aside cases without mixing them',()=>{assert.equal(validateEvaluationFile(fixture).cases.length,4);const check=validateEvaluationFile(fixture,'check');assert.equal(check.cases.length,2);assert.ok(check.cases.every(c=>c.split==='check'));});
test('evaluation rejects oversized, ambiguous or mislabeled input before a provider call',()=>{for(const change of [(x)=>x.cases[0].expected='perfect',(x)=>x.cases[0].text='a'.repeat(5001),(x)=>x.cases.push(x.cases[0]),(x)=>x.criteria='',(x)=>x.cases[0].split='unknown']){const value=structuredClone(fixture);change(value);assert.throws(()=>validateEvaluationFile(value));}assert.throws(()=>validateEvaluationFile(fixture,'all'));});
