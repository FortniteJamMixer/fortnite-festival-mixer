export async function runPerfSmokeTests(){
  const results = [];
  const assert = (condition, message) => {
    if(!condition){
      throw new Error(message);
    }
  };

  const initialCards = document.querySelectorAll('.song-card');
  if(!initialCards.length){
    throw new Error('No song cards found. Load the app and open the browser view before running the test.');
  }

  window.__forceMobileViewport = true;
  window.renderSongList();
  const mobileCardCount = document.querySelectorAll('.song-card').length;
  assert(mobileCardCount <= 80, `Expected <= 80 cards on mobile render, saw ${mobileCardCount}`);
  results.push(`Mobile card cap OK (${mobileCardCount})`);

  const searchInput = document.getElementById('searchInput');
  if(!searchInput){
    throw new Error('Search input missing. Ensure browser view is visible.');
  }
  const renderStart = window.__perfState?.listRenderCount || 0;
  ['t','te','tes','test','testy'].forEach((val) => {
    searchInput.value = val;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((resolve) => setTimeout(resolve, 220));
  const renderDelta = (window.__perfState?.listRenderCount || 0) - renderStart;
  assert(renderDelta <= 2, `Expected debounce to limit renders, render delta was ${renderDelta}`);
  results.push(`Search debounce OK (render delta ${renderDelta})`);

  const cardId = document.querySelector('.song-card')?.dataset?.songId;
  if(!cardId){
    throw new Error('No song card id found for owned toggle test.');
  }
  const ownedRenderStart = window.__perfState?.listRenderCount || 0;
  await window.toggleOwned(cardId);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const ownedRenderDelta = (window.__perfState?.listRenderCount || 0) - ownedRenderStart;
  assert(ownedRenderDelta === 0, `Owned toggle should not rerender list (delta ${ownedRenderDelta})`);
  results.push('Owned toggle UI update OK');

  window.__forceMobileViewport = false;
  return results;
}

if(typeof window !== 'undefined'){
  window.runPerfSmokeTests = runPerfSmokeTests;
}
