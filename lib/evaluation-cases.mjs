export function validateEvaluationFile(value, split = 'develop') {
  const bounded = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
  if (!['develop','check'].includes(split) || !bounded(value?.goal,8,300) || !bounded(value?.criteria,8,300) || !Array.isArray(value?.cases) || value.cases.length < 1 || value.cases.length > 8) throw new Error('Use goal and criteria of 8–300 characters, 1–8 cases, and split develop or check.');
  const ids = new Set();
  const cases = value.cases.map(item=>{
    if(!bounded(item?.id,1,60) || ids.has(item.id) || !bounded(item.text,8,5000) || !['read','skip','unsure'].includes(item.expected) || !['develop','check'].includes(item.split)) throw new Error('Every case needs a unique id, 8–5,000 character text, expected read/skip/unsure, and split develop/check.');
    ids.add(item.id); return {id:item.id,text:item.text,expected:item.expected,split:item.split};
  }).filter(item=>item.split===split);
  if(!cases.length) throw new Error('No cases in the selected split.');
  return {goal:value.goal.trim(),criteria:value.criteria.trim(),cases};
}
