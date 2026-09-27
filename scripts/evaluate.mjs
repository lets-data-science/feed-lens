import {readFile} from 'node:fs/promises';
import {askReadingJev,decideReading} from '../lib/reading.mjs';
import {validateEvaluationFile} from '../lib/evaluation-cases.mjs';
const args=process.argv.slice(2),after=flag=>args[args.indexOf(flag)+1];
try {
 if(!args.includes('--file')) throw new Error('Usage: npm run evaluate -- --file examples/my-lens.json --split develop [--live]');
 const config=validateEvaluationFile(JSON.parse(await readFile(after('--file'),'utf8')),args.includes('--split')?after('--split'):'develop');
 if(!args.includes('--live')) console.log(`Valid: ${config.cases.length} selected cases. No request made. Add --live to send their fictional text and your criteria to TypeSafe. Provider charges apply; this CLI run is outside the web session counter.`);
 else {
  let matches=0;
  for(const example of config.cases){const response=await askReadingJev(example.text,config.goal,{criteria:config.criteria,apiKey:process.env.TYPESAFE_API_KEY}); const decision=decideReading(response.answers);matches+=Number(decision.verdict===example.expected);console.log(JSON.stringify({id:example.id,expected:example.expected,actual:decision.verdict,model:response.model,answers:response.answers,usage:response.usage}));}
  console.log(`${matches}/${config.cases.length} agreed with your expectations. Inspect disagreements; this small authored set is not a population accuracy estimate.`);
 }
} catch(error) {console.error(error.message);process.exitCode=1;}
