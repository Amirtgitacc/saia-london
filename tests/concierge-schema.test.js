const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { TOOLS, SCHEMA, systemPrompt } = require('../js/concierge-core.js');

/* Two silent-failure modes this file exists to catch:

   1. args carries additionalProperties:false, so an arg the system prompt tells Claude
      to send but the schema omits can NEVER be emitted. That is how request_pilates
      lost its {type} — the prompt asked for it, planner.js read it, and it never arrived.
   2. CLAUDE.md: "a tool advertised in TOOLS but missing from applyActions() is silently
      ignored at runtime." Same class of bug, other end of the pipe. */

const ARG_PROPS = SCHEMA.properties.actions.items.properties.args.properties;

// Pull the "ACTIONS you may emit" block out of the prompt and read every {arg} it names.
function promptArgKeys() {
  const lines = systemPrompt({}).split('\n');
  const start = lines.findIndex((l) => l.indexOf('ACTIONS you may emit') === 0);
  assert.ok(start !== -1, 'the prompt must still carry an "ACTIONS you may emit" block');
  const end = lines.findIndex((l, i) => i > start && l.indexOf('CURRENT HIRE STATE') === 0);
  const block = lines.slice(start, end === -1 ? lines.length : end).filter((l) => l.indexOf('- ') === 0);
  const keys = new Set();
  block.forEach((line) => {
    (line.match(/\{[^}]*\}/g) || []).forEach((brace) => {
      brace.slice(1, -1).split(',').forEach((part) => {
        const key = part.split(':')[0].trim();
        if (/^[a-z][a-zA-Z]*$/.test(key)) keys.add(key);
      });
    });
  });
  return keys;
}

test('every arg the system prompt asks for exists in the schema', () => {
  const missing = [...promptArgKeys()].filter((k) => !(k in ARG_PROPS));
  assert.deepStrictEqual(missing, [],
    'additionalProperties:false means these can never be emitted: ' + missing.join(', '));
});

test('request_pilates can carry its class type', () => {
  assert.ok(ARG_PROPS.type, 'planner.js reads args.type for request_pilates');
  assert.deepStrictEqual(ARG_PROPS.type.enum, ['1-2-1', 'group']);
});

test('every advertised tool is handled by applyActions()', () => {
  const planner = fs.readFileSync(path.join(__dirname, '..', 'js', 'planner.js'), 'utf8');
  const unhandled = TOOLS.filter((t) => planner.indexOf("case '" + t + "'") === -1);
  assert.deepStrictEqual(unhandled, [],
    'advertised to Claude but silently ignored at runtime: ' + unhandled.join(', '));
});

test('the schema only advertises tools that exist in TOOLS', () => {
  assert.deepStrictEqual(SCHEMA.properties.actions.items.properties.tool.enum, TOOLS);
});

test('CLAUDE.md documents the same 15 tools the code advertises', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
  const undocumented = TOOLS.filter((t) => doc.indexOf(t) === -1);
  assert.deepStrictEqual(undocumented, []);
});
