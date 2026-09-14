import assert from 'node:assert/strict';
import { test } from 'node:test';
import { childIn, eventsForDelivery, hostResult } from '../runtime/lib/delivery-events.ts';
import {
  actionResultEventSchema,
  parseActionResultEvent,
  parseFactoryEvent,
  parseSubagentCalledEvent,
  parseSuccessfulActionResultEvent,
} from '../runtime/lib/factory-protocol.ts';
import { projectRunEvent } from '../runtime/lib/cockpit-run.ts';
import { ownerPublication } from '../runtime/lib/work-owner.ts';
import { workBranch } from '../runtime/lib/work-github.ts';
import { factoryRepositoryUrl } from '../runtime/lib/factory-config.ts';

const owner = 'wrun_owner';
const operationId = '11111111-1111-4111-8111-111111111111';
const branch = workBranch(owner);
const headSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const deliveryId = 'delivery-one';

const publication = {
  branch,
  number: 48,
  url: `${factoryRepositoryUrl}/pull/48`,
  headSha,
  baseSha,
  ownerSessionId: owner,
  targetBranch: 'main',
  targetHeadSha: baseSha,
};

function publicationEvent() {
  return {
    type: 'action.result',
    meta: { deliveryIds: [deliveryId] },
    data: {
      status: 'completed',
      result: {
        kind: 'tool-result',
        toolName: 'publish_work',
        output: {
          station: 'worker',
          sessionId: owner,
          operationId,
          revisionProtocol: 1,
          revision: headSha,
          summary: 'Published the candidate.',
          publication,
          commands: [],
        },
      },
    },
  };
}

test('delivery, cockpit, and owner consumers share the typed action result envelope', () => {
  const event = publicationEvent();

  assert.equal(actionResultEventSchema.safeParse(event).success, true);
  assert.equal(parseFactoryEvent(event)?.type, 'action.result');
  assert.equal(parseActionResultEvent(event)?.data.result.toolName, 'publish_work');
  assert.equal(parseSuccessfulActionResultEvent(event)?.data.result.toolName, 'publish_work');
  assert.equal(projectRunEvent(event, operationId)?.kind, 'work');
  assert.equal(hostResult(eventsForDelivery([event], deliveryId), 'publish_work', owner, operationId)?.operationId, operationId);
  assert.equal(ownerPublication(event, owner, publication.number, branch)?.ownerSessionId, owner);
});

test('the shared parser preserves the successful-result boundary for all consumers', () => {
  const event = publicationEvent();
  const failed = {
    ...event,
    data: { ...event.data, result: { ...event.data.result, isError: true } },
  };

  assert.equal(parseActionResultEvent(failed)?.data.result.isError, true);
  assert.equal(parseSuccessfulActionResultEvent(failed), undefined);
  assert.equal(projectRunEvent(failed, operationId), undefined);
  assert.equal(hostResult([failed], 'publish_work', owner, operationId), undefined);
  assert.equal(ownerPublication(failed, owner, publication.number, branch), null);
});

test('shared event parsing keeps child discovery and delivery metadata typed', () => {
  const child = {
    type: 'subagent.called',
    meta: { deliveryIds: [deliveryId] },
    data: { name: 'worker', childSessionId: 'wrun_child' },
  };
  const event = publicationEvent();

  assert.deepEqual(parseSubagentCalledEvent(child), { name: 'worker', childSessionId: 'wrun_child' });
  assert.equal(childIn([child]), 'wrun_child');
  assert.deepEqual(eventsForDelivery([child, event], deliveryId), [child, event]);
  assert.equal(parseFactoryEvent({ ...event, meta: { deliveryIds: 'not-an-array' } }), undefined);
});
