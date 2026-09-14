const rules = [
  ['AI Regulation / Policy', /\b(regulat(?:ion|ions|ory|e|es|ed|ing)|legislation|lawmakers|antitrust|copyright|lawsuit|sues|sued|policy)\b/i],
  ['AI Security', /\b(breach|vulnerability|cyber|sandbox escape|hacked|security|outages?)\b/i],
  ['AI Safety', /\b(safety|alignment|safeguards|watermark|bioweapons|misuse)\b/i],
  ['Robotics', /\b(robot|robots|robotics|humanoid|motor programs)\b/i],
  ['Open Source AI', /\b(open.source|open weights)\b/i],
  ['AI Chips / Hardware', /\b(chip|chips|gpu|gpus|blackwell|jetson)\b/i],
  ['Model Release', /\b(launch|launches|release|releases|introducing|unveils)\b.*\b(model|gpt|claude|gemini|llama)\b/i],
  ['AI Agents', /\b(agent|agents|agentic|agentcore)\b/i],
  ['AI Coding', /\b(coding|developer|programming|code|software|mcp)\b/i],
  ['AI Companies', /\b(acquir|acquisition|funding|valuation|merger|investment)\w*/i],
  ['AI Research', /\b(research|paper|benchmark|training|neural|learning|distillation)\b/i],
  ['AI Infrastructure', /\b(inference|datacenter|data center|infrastructure|cloud)\b/i],
  ['Healthcare AI', /\b(medical|clinical|healthcare|health plans|fda|patient)\b/i],
  ['Education AI', /\b(education|classroom|students|teaching)\b/i],
  ['Business / Enterprise AI', /\b(enterprise|business|salesforce|bookings|data products|government|job market)\b/i],
  ['Generative AI', /\b(writing with ai|write custom fiction|image generation|text generation|generative|video generation)\b/i],
];
function inferCategory(title = '', description = '') {
  return rules.find(([, re]) => re.test(title))?.[0] || rules.find(([, re]) => re.test(description))?.[0] || 'Other';
}
module.exports = { inferCategory };
