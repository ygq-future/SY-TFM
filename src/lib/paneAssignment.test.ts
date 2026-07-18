import { describe, expect, it } from 'vitest';
import {
  activateHostInPane,
  assignConnectedHost,
  collapseToSinglePane,
  reconcilePaneHosts,
} from './paneAssignment';

describe('pane connection assignment', () => {
  it('fills pane one first after all connections were closed', () => {
    expect(assignConnectedHost([null, null], 'host-c', true)).toEqual(['host-c', null]);
  });

  it('fills pane two only after pane one has a connection', () => {
    expect(assignConnectedHost(['host-a', null], 'host-b', true)).toEqual(['host-a', 'host-b']);
  });

  it('promotes pane two when pane one disconnects and clears both after the last disconnect', () => {
    expect(reconcilePaneHosts(['host-a', 'host-b'], ['host-b'], true)).toEqual([
      'host-b',
      'host-b',
    ]);
    expect(reconcilePaneHosts(['host-b', 'host-b'], [], true)).toEqual([null, null]);
  });

  it('never leaves the visible pane empty when collapsing to one pane', () => {
    expect(collapseToSinglePane([null, 'host-b'])).toEqual(['host-b', 'host-b']);
  });

  it('switches the visible single pane when the user explicitly activates another host', () => {
    expect(activateHostInPane(['host-a', 'host-b'], 'host-b', false, 0)).toEqual({
      hosts: ['host-b', 'host-b'],
      activePane: 0,
    });
  });

  it('activates an existing dual pane without reallocating either host', () => {
    expect(activateHostInPane(['host-a', 'host-b'], 'host-b', true, 0)).toEqual({
      hosts: ['host-a', 'host-b'],
      activePane: 1,
    });
  });
});
