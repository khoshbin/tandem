import { watch, removed, Struct, moved, stoppedMoving, moveBounds, scaleInnerBounds, resized, keepBoundsAspectRatio, request, shiftBounds } from "aerial-common2";
import { take, select, call, put, fork, spawn, cancel } from "redux-saga/effects";
import { delay } from "redux-saga";
import { 
  RESIZER_MOVED,
  RESIZER_STOPPED_MOVING,
  ResizerMoved,
  resizerStoppedMoving,
  LEFT_KEY_DOWN,
  LEFT_KEY_UP,
  RIGHT_KEY_DOWN,
  RIGHT_KEY_UP,
  UP_KEY_DOWN,
  UP_KEY_UP,
  DOWN_KEY_DOWN,
  DOWN_KEY_UP,
  ResizerPathMoved,
  resizerMoved,
  TEXT_EDITOR_CHANGED,
  NEXT_WINDOW_SHORTCUT_PRESSED,
  PREV_WINDOW_SHORTCUT_PRESSED,
  TextEditorChanged,
  RESIZER_PATH_MOUSE_MOVED,
  DeleteShortcutPressed, 
  SOURCE_CLICKED,
  SourceClicked,
  OPEN_NEW_WINDOW_SHORTCUT_PRESSED,
  windowSelectionShifted,
  WINDOW_SELECTION_SHIFTED,
  CLONE_WINDOW_SHORTCUT_PRESSED,
  OPEN_EXTERNAL_WINDOW_BUTTON_CLICKED,
  OpenExternalWindowButtonClicked,
  PROMPTED_NEW_WINDOW_URL,
  PromptedNewWindowUrl,
  DELETE_SHORCUT_PRESSED, 
  fullScreenTargetDeleted,
  StageToolOverlayClicked, 
  workspaceSelectionDeleted,
  STAGE_MOUSE_CLICKED, 
} from "../actions";

import { URI_CACHE_BUSTED, uriCacheBusted } from "aerial-sandbox2";
const WINDOW_PADDING = 10;

import { 
  getUri,
  SEnvNodeTypes, 
  SyntheticWindow, 
  SyntheticElement, 
  SYNTHETIC_WINDOW,
  getSyntheticWindow,
  getSyntheticNodeById, 
  getSyntheticNodeWindow,
  getSyntheticWindowBrowser,
  getSyntheticBrowserBounds,
  openSyntheticWindowRequest, 
} from "aerial-browser-sandbox";

import { 
  Workspace,
  getSyntheticBrowserItemBounds,
  getStageTranslate,
  getWorkspaceById,
  ApplicationState, 
  getWorkspaceWindow,
  getSelectedWorkspace, 
  getWorkspaceSelectionBounds,
  getBoundedWorkspaceSelection,
  getWorkspaceLastSelectionOwnerWindow,
  getSyntheticWindowWorkspace,
  getStageToolMouseNodeTargetReference,
} from "../state";

export function* mainWorkspaceSaga() {
  yield fork(openDefaultWindow);
  yield fork(handleAltClickElement);
  yield fork(handleDeleteKeyPressed);
  yield fork(handleNextWindowPressed);
  yield fork(handlePrevWindowPressed);
  yield fork(handleSelectionMoved);
  yield fork(handleSelectionStoppedMoving);
  yield fork(handleSelectionKeyDown);
  yield fork(handleSelectionKeyUp);
  yield fork(handleTextEditorChange);
  yield fork(handleSelectionResized);
  yield fork(handleNewLocationPrompt);
  yield fork(handleOpenNewWindowShortcut);
  yield fork(handleCloneSelectedWindowShortcut);
  yield fork(handleSourceClicked);
  yield fork(handleOpenExternalWindowButtonClicked);
}

function* openDefaultWindow() {
  yield watch((state: ApplicationState) => state.selectedWorkspaceId, function*(selectedWorkspaceId, state) {
    if (!selectedWorkspaceId) return true;
    const workspace = getSelectedWorkspace(state);
    
    // yield put(openSyntheticWindowRequest(`http://localhost:8083/`, workspace.browserId));
    // yield put(openSyntheticWindowRequest("http://browsertap.com/", workspace.browserId));
    // yield put(openSyntheticWindowRequest("https://wordpress.com/", workspace.browserId));
    // yield put(openSyntheticWindowRequest("http://localhost:8080/index.html", workspace.browserId));
    return true;
  });
}

function* handleOpenExternalWindowButtonClicked() {
  while(true) {
    const { windowId }: OpenExternalWindowButtonClicked = yield take(OPEN_EXTERNAL_WINDOW_BUTTON_CLICKED);
    const syntheticWindow = getSyntheticWindow(yield select(), windowId);
    window.open(syntheticWindow.location, "_blank");
  }
}

function* handleAltClickElement() {
  while(true) {
    const event: StageToolOverlayClicked = yield take((action: StageToolOverlayClicked) => action.type === STAGE_MOUSE_CLICKED && action.sourceEvent.altKey);
    const state = yield select();
    const targetRef = getStageToolMouseNodeTargetReference(state, event);
    const workspace = getSelectedWorkspace(state);
    if (!targetRef) continue;
    const node = getSyntheticNodeById(state, targetRef[1]);
    if (node.nodeType === SEnvNodeTypes.ELEMENT) {
      const element = node as SyntheticElement;
      if (element.nodeName === "A") {
        const href = element.attributes.find((a) => a.name === "href");
        if (href) {
          const window = getSyntheticNodeWindow(state, node.$id);
          const browserBounds = getSyntheticBrowserBounds(getSyntheticWindowBrowser(state, window.$id));
          const workspace = getSyntheticWindowWorkspace(state, window.$id);
          yield openNewWindow(state, href.value, window, workspace);
        }
      }
    }
  }
}

function* openNewWindow(state: ApplicationState, href: string, origin: SyntheticWindow, workspace: Workspace) {
  const uri = getUri(href, origin.location);
  const windowBounds = workspace.stage.fullScreen ? workspace.stage.fullScreen.originalWindowBounds : origin.bounds;
  const browserBounds = getSyntheticBrowserBounds(getSyntheticWindowBrowser(state, origin.$id));
  yield put(openSyntheticWindowRequest({ location: uri, bounds: {
    left: Math.max(browserBounds.right, windowBounds.right) + WINDOW_PADDING,
    top: 0,
    right: undefined,
    bottom: undefined
  }}, workspace.browserId));
}

function* handleDeleteKeyPressed() {
  while(true) {
    const action = (yield take(DELETE_SHORCUT_PRESSED)) as DeleteShortcutPressed;
    const state = yield select();
    const { sourceEvent } = event as DeleteShortcutPressed;
    const workspace = getSelectedWorkspace(state);
    for (const [type, id] of workspace.selectionRefs) {
      yield put(removed(id, type));

      if (workspace.stage.fullScreen && workspace.stage.fullScreen.windowId === id) {
        yield put(fullScreenTargetDeleted());
      }
    }
    yield put(workspaceSelectionDeleted(workspace.$id));
  }
}

function* handleSelectionMoved() {
  while(true) {
    const { point, workspaceId, point: newPoint } = (yield take(RESIZER_MOVED)) as ResizerMoved;
    const state = (yield select()) as ApplicationState;
    const workspace = getWorkspaceById(state, workspaceId);
    const translate = getStageTranslate(workspace.stage);

    const selectionBounds = getWorkspaceSelectionBounds(state, workspace);
    for (const item of getBoundedWorkspaceSelection(state, workspace)) {
      const itemBounds = getSyntheticBrowserItemBounds(state, item);

      // skip moving window if in full screen mode
      if (workspace.stage.fullScreen && workspace.stage.fullScreen.windowId === item.$id) {
        continue;
      }
      

      yield put(moved(item.$id, item.$type, scaleInnerBounds(itemBounds, selectionBounds, moveBounds(selectionBounds, newPoint)), workspace.targetCSSSelectors));
    }
  }
}

function* handleSelectionResized() {
  while(true) {
    let { workspaceId, anchor, originalBounds, newBounds, sourceEvent } = (yield take(RESIZER_PATH_MOUSE_MOVED)) as ResizerPathMoved;

    const state: ApplicationState = yield select();
 
    const workspace = getWorkspaceById(state, workspaceId);

    // TODO - possibly use BoundsStruct instead of Bounds since there are cases where bounds prop doesn't exist
    const currentBounds = getWorkspaceSelectionBounds(state, workspace);


    const keepAspectRatio = sourceEvent.shiftKey;
    const keepCenter      = sourceEvent.altKey;

    if (keepCenter) {
      // newBounds = keepBoundsCenter(newBounds, bounds, anchor);
    }

    if (keepAspectRatio) {
      newBounds = keepBoundsAspectRatio(newBounds, originalBounds, anchor, keepCenter ? { left: 0.5, top: 0.5 } : anchor);
    }

    for (const item of getBoundedWorkspaceSelection(state, workspace)) {
      const innerBounds = getSyntheticBrowserItemBounds(state, item);
      const scaledBounds = scaleInnerBounds(currentBounds, currentBounds, newBounds);
      yield put(resized(item.$id, item.$type, scaleInnerBounds(innerBounds, currentBounds, newBounds), workspace.targetCSSSelectors));
    }
  }
}

function* handleOpenNewWindowShortcut() {
  while(true) {
    yield take(OPEN_NEW_WINDOW_SHORTCUT_PRESSED);
    const uri = prompt("URL");
    if (!uri) continue;
    const state: ApplicationState = yield select();
    const workspace = getSelectedWorkspace(state);
    yield put(openSyntheticWindowRequest({ location: uri }, workspace.browserId));

  }
}

function* handleCloneSelectedWindowShortcut() {
  while(true) {
    yield take(CLONE_WINDOW_SHORTCUT_PRESSED);
    const state: ApplicationState = yield select();
    const workspace = getSelectedWorkspace(state);
    const itemRef = workspace.selectionRefs[0];
    if (!itemRef) continue;
    const window = itemRef[0] === SYNTHETIC_WINDOW ? getSyntheticWindow(state, itemRef[1]) : getSyntheticNodeWindow(state, itemRef[1]);

    const originalWindowBounds = workspace.stage.fullScreen ? workspace.stage.fullScreen.originalWindowBounds : window.bounds; 

    const clonedWindow = yield yield request(openSyntheticWindowRequest({ location: window.location, bounds: moveBounds(originalWindowBounds, {
      left: originalWindowBounds.left,
      top: originalWindowBounds.bottom + WINDOW_PADDING
    }) }, getSyntheticWindowBrowser(state, window.$id).$id));
  }
}

function* handleNewLocationPrompt() {
  while(true) {
    const { workspaceId, location } = (yield take(PROMPTED_NEW_WINDOW_URL)) as PromptedNewWindowUrl;
    yield put(openSyntheticWindowRequest({ location }, getWorkspaceById(yield select(), workspaceId).browserId))
  }
}

function* handleSelectionKeyDown() {

  while(true) {
    const { type } = yield take([LEFT_KEY_DOWN, RIGHT_KEY_DOWN, UP_KEY_DOWN, DOWN_KEY_DOWN]);
    const state: ApplicationState = yield select();
    const workspace: Workspace = getSelectedWorkspace(state);
    if (workspace.selectionRefs.length === 0) continue;
    const workspaceId = workspace.$id;
    const bounds = getWorkspaceSelectionBounds(state, workspace);

    switch(type) {
      case DOWN_KEY_DOWN: {
        yield put(resizerMoved(workspaceId, { left: bounds.left, top: bounds.top + 1 }));
        break;
      }
      case UP_KEY_DOWN: {
        yield put(resizerMoved(workspaceId, { left: bounds.left, top: bounds.top - 1 }));
        break;
      }
      case LEFT_KEY_DOWN: {
        yield put(resizerMoved(workspaceId, { left: bounds.left - 1, top: bounds.top }));
        break;
      }
      case RIGHT_KEY_DOWN: {
        yield put(resizerMoved(workspaceId, { left: bounds.left + 1, top: bounds.top }));
        break;
      }
    }
  }
}

function* handleSelectionKeyUp() {
  while(true) {
    yield take([LEFT_KEY_UP, RIGHT_KEY_UP, UP_KEY_UP, DOWN_KEY_UP]);
    const state: ApplicationState = yield select();
    const workspace: Workspace = getSelectedWorkspace(state);
    yield put(resizerStoppedMoving(workspace.$id, null));
  }
}

function* handleSourceClicked() {
  while(true) {
    const { itemId, windowId } = (yield take(SOURCE_CLICKED)) as SourceClicked;
    console.log("SOURCE CLICKED", itemId, windowId);
  }
}

function* handleSelectionStoppedMoving() {
  while(true) {
    const { point, workspaceId } = (yield take(RESIZER_STOPPED_MOVING)) as ResizerMoved;
    const state = (yield select()) as ApplicationState;
    const workspace = getWorkspaceById(state, workspaceId);
    for (const item of getBoundedWorkspaceSelection(state, workspace)) {

      // skip moving window if in full screen mode
      if (workspace.stage.fullScreen && workspace.stage.fullScreen.windowId === item.$id) {
        continue;
      }
      
      const bounds = getSyntheticBrowserItemBounds(state, item);
      yield put(stoppedMoving(item.$id, item.$type, workspace.targetCSSSelectors));
    }
  }
}

function* handleTextEditorChange() {
  while(true) {
    const { value, file } = (yield take(TEXT_EDITOR_CHANGED)) as TextEditorChanged;
    yield put(uriCacheBusted(file.sourceUri, value, file.contentType));
  }
}

function* handleNextWindowPressed() {
  while(true) {
    yield take(NEXT_WINDOW_SHORTCUT_PRESSED);
    yield call(shiftSelectedWindow, 1);
  }
}

function* handlePrevWindowPressed() {
  while(true) {
    yield take(PREV_WINDOW_SHORTCUT_PRESSED);
    yield call(shiftSelectedWindow, -1);
  }
}

function* shiftSelectedWindow(indexDelta: number) {
  const state: ApplicationState = yield select();
  const window = getWorkspaceLastSelectionOwnerWindow(state, state.selectedWorkspaceId) || getWorkspaceWindow(state, state.selectedWorkspaceId);
  if (!window) {
    return;
  }
  const browser = getSyntheticWindowBrowser(state, window.$id);

  const index = browser.windows.indexOf(window);
  const change = index + indexDelta

  // TODO - change index based on window location, not index
  const newIndex = change < 0 ? browser.windows.length - 1 : change >= browser.windows.length ? 0 : change;
  yield put(windowSelectionShifted(browser.windows[newIndex].$id))
}