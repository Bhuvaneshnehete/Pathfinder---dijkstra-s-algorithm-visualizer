(function(){
  const ROWS = 16;
  const COLS = 32;
  const WEIGHT_COST = 5;

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const speedSlider = document.getElementById('speedSlider');
  const wallModeBtn = document.getElementById('wallModeBtn');
  const weightModeBtn = document.getElementById('weightModeBtn');
  const visualizeBtn = document.getElementById('visualizeBtn');
  const clearPathBtn = document.getElementById('clearPathBtn');
  const clearBoardBtn = document.getElementById('clearBoardBtn');

  let start = { row: Math.floor(ROWS/2), col: 3 };
  let end   = { row: Math.floor(ROWS/2), col: COLS-4 };

  let grid = [];        // grid[row][col] = node object
  let cellEls = [];      // matching DOM elements

  let mode = 'wall';     // 'wall' | 'weight'
  let isMouseDown = false;
  let dragTarget = null; // 'start' | 'end' | null
  let paintValue = null; // true = adding, false = removing (for wall/weight painting)
  let running = false;
  let lastPaintedCell = null; // tracks last cell painted this stroke, to interpolate fast drags

  // Bresenham line so fast drags/diagonal moves never skip a cell and leave a gap
  function cellsBetween(a, b){
    const points = [];
    let x0 = a.col, y0 = a.row, x1 = b.col, y1 = b.row;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while(true){
      points.push({ row: y0, col: x0 });
      if(x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if(e2 >= dy){ err += dy; x0 += sx; }
      if(e2 <= dx){ err += dx; y0 += sy; }
    }
    return points;
  }

  function paintCell(row, col){
    if(isStartEnd(row,col)) return;
    const node = grid[row][col];
    if(mode === 'wall'){
      node.isWall = paintValue;
      if(paintValue) node.isWeight = false;
    } else {
      node.isWeight = paintValue;
      if(paintValue) node.isWall = false;
    }
    refreshCellClasses(row, col);
  }

  function makeNode(row, col){
    return {
      row, col,
      isWall: false,
      isWeight: false,
      distance: Infinity,
      visited: false,
      previous: null
    };
  }

  function buildGrid(){
    grid = [];
    for(let r=0;r<ROWS;r++){
      const row = [];
      for(let c=0;c<COLS;c++) row.push(makeNode(r,c));
      grid.push(row);
    }
  }

  function buildBoardDOM(){
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${COLS}, 24px)`;
    boardEl.style.gridTemplateRows = `repeat(${ROWS}, 24px)`;
    cellEls = [];
    for(let r=0;r<ROWS;r++){
      const rowEls = [];
      for(let c=0;c<COLS;c++){
        const div = document.createElement('div');
        div.className = 'cell';
        div.dataset.row = r;
        div.dataset.col = c;
        boardEl.appendChild(div);
        rowEls.push(div);
      }
      cellEls.push(rowEls);
    }
  }

  function refreshCellClasses(r,c){
    const el = cellEls[r][c];
    const node = grid[r][c];
    el.className = 'cell';
    if(node.isWall) el.classList.add('wall');
    else if(node.isWeight) el.classList.add('weight');
    if(r===start.row && c===start.col) el.classList.add('start');
    if(r===end.row && c===end.col) el.classList.add('end');
  }

  function refreshAll(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) refreshCellClasses(r,c);
  }

  function setStatus(msg, success){
    statusEl.innerHTML = msg;
    statusEl.classList.toggle('success', !!success);
  }

  // ---------- interaction ----------
  function isStartEnd(r,c){
    return (r===start.row && c===start.col) || (r===end.row && c===end.col);
  }

  function cellFromTarget(target){
    if(!target || !target.dataset || target.dataset.row === undefined) return null;
    return { row: parseInt(target.dataset.row,10), col: parseInt(target.dataset.col,10) };
  }

  function pointerCell(evt){
    let clientX, clientY;
    if(evt.touches && evt.touches.length){
      clientX = evt.touches[0].clientX; clientY = evt.touches[0].clientY;
    } else {
      clientX = evt.clientX; clientY = evt.clientY;
    }
    const el = document.elementFromPoint(clientX, clientY);
    return cellFromTarget(el);
  }

  function onDown(evt){
    if(running) return;
    const cell = pointerCell(evt);
    if(!cell) return;
    isMouseDown = true;

    if(cell.row===start.row && cell.col===start.col){
      dragTarget = 'start';
    } else if(cell.row===end.row && cell.col===end.col){
      dragTarget = 'end';
    } else {
      dragTarget = null;
      const node = grid[cell.row][cell.col];
      paintValue = mode === 'wall' ? !node.isWall : !node.isWeight;
      lastPaintedCell = cell;
      paintCell(cell.row, cell.col);
    }
    evt.preventDefault();
  }

  function onMove(evt){
    if(!isMouseDown || running) return;
    const cell = pointerCell(evt);
    if(!cell) return;

    if(dragTarget === 'start'){
      if(isStartEnd(cell.row,cell.col)) return;
      const old = {...start};
      start = { row: cell.row, col: cell.col };
      grid[start.row][start.col].isWall = false;
      grid[start.row][start.col].isWeight = false;
      refreshCellClasses(old.row, old.col);
      refreshCellClasses(start.row, start.col);
    } else if(dragTarget === 'end'){
      if(isStartEnd(cell.row,cell.col)) return;
      const old = {...end};
      end = { row: cell.row, col: cell.col };
      grid[end.row][end.col].isWall = false;
      grid[end.row][end.col].isWeight = false;
      refreshCellClasses(old.row, old.col);
      refreshCellClasses(end.row, end.col);
    } else if(dragTarget === null){
      if(lastPaintedCell){
        for(const pt of cellsBetween(lastPaintedCell, cell)){
          paintCell(pt.row, pt.col);
        }
      } else {
        paintCell(cell.row, cell.col);
      }
      lastPaintedCell = cell;
    }
    evt.preventDefault();
  }

  function onUp(){
    isMouseDown = false;
    dragTarget = null;
    paintValue = null;
    lastPaintedCell = null;
  }

  boardEl.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  boardEl.addEventListener('touchstart', onDown, {passive:false});
  boardEl.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('touchend', onUp, {passive:false});

  wallModeBtn.addEventListener('click', ()=>{
    mode = 'wall';
    wallModeBtn.classList.add('active');
    weightModeBtn.classList.remove('active');
  });
  weightModeBtn.addEventListener('click', ()=>{
    mode = 'weight';
    weightModeBtn.classList.add('active');
    wallModeBtn.classList.remove('active');
  });

  // ---------- Dijkstra ----------
  function neighborsOf(node){
    const {row,col} = node;
    const list = [];
    if(row>0) list.push(grid[row-1][col]);
    if(row<ROWS-1) list.push(grid[row+1][col]);
    if(col>0) list.push(grid[row][col-1]);
    if(col<COLS-1) list.push(grid[row][col+1]);
    return list.filter(n => !n.isWall);
  }

  function runDijkstra(){
    // reset algorithm state but keep walls/weights
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      grid[r][c].distance = Infinity;
      grid[r][c].visited = false;
      grid[r][c].previous = null;
    }
    const startNode = grid[start.row][start.col];
    const endNode = grid[end.row][end.col];
    startNode.distance = 0;

    const unvisited = [];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(!grid[r][c].isWall) unvisited.push(grid[r][c]);

    const visitedInOrder = [];

    while(unvisited.length){
      // pick node with smallest tentative distance (simple linear scan — grid is small)
      let closestIdx = 0;
      for(let i=1;i<unvisited.length;i++){
        if(unvisited[i].distance < unvisited[closestIdx].distance) closestIdx = i;
      }
      const current = unvisited[closestIdx];
      unvisited.splice(closestIdx,1);

      if(current.distance === Infinity) break; // remaining nodes unreachable

      current.visited = true;
      visitedInOrder.push(current);

      if(current === endNode) break;

      for(const neighbor of neighborsOf(current)){
        if(neighbor.visited) continue;
        const cost = neighbor.isWeight ? WEIGHT_COST : 1;
        const alt = current.distance + cost;
        if(alt < neighbor.distance){
          neighbor.distance = alt;
          neighbor.previous = current;
        }
      }
    }

    // reconstruct path
    const path = [];
    let cur = endNode;
    if(cur.distance !== Infinity){
      while(cur){
        path.unshift(cur);
        cur = cur.previous;
      }
    }
    return { visitedInOrder, path };
  }

  function clearPathVisuals(){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      cellEls[r][c].classList.remove('visited','path','weight-visited');
    }
    refreshAll();
  }

  function setControlsDisabled(disabled){
    visualizeBtn.disabled = disabled;
    clearPathBtn.disabled = disabled;
    clearBoardBtn.disabled = disabled;
    wallModeBtn.disabled = disabled;
    weightModeBtn.disabled = disabled;
  }

  function visualize(){
    if(running) return;
    running = true;
    setControlsDisabled(true);
    clearPathVisuals();
    setStatus('Exploring the board, cheapest cost first...');

    const { visitedInOrder, path } = runDijkstra();
    const speed = parseInt(speedSlider.value,10);
    const delay = Math.max(2, 40 - speed*4);

    let i = 0;
    function stepVisit(){
      const batch = Math.max(1, Math.floor(speed/2));
      for(let b=0; b<batch && i<visitedInOrder.length; b++, i++){
        const node = visitedInOrder[i];
        if(node.isWall) continue;
        if(node.row===start.row && node.col===start.col) continue;
        if(node.row===end.row && node.col===end.col) continue;
        const el = cellEls[node.row][node.col];
        el.classList.add('visited');
        if(node.isWeight) el.classList.add('weight-visited');
      }
      if(i < visitedInOrder.length){
        setTimeout(stepVisit, delay);
      } else {
        drawPath();
      }
    }

    function drawPath(){
      if(path.length <= 1){
        setStatus('No path exists — that route is completely walled off.');
        running = false;
        setControlsDisabled(false);
        return;
      }
      let j = 0;
      function stepPath(){
        if(j >= path.length){
          const endNode = grid[end.row][end.col];
          const cost = endNode.distance;
          setStatus(`Shortest path found — total cost <b>${cost}</b> across <b>${path.length-1}</b> steps.`, true);
          running = false;
          setControlsDisabled(false);
          return;
        }
        const node = path[j];
        const isEndpoint = (node.row===start.row && node.col===start.col) || (node.row===end.row && node.col===end.col);
        if(!node.isWall && !isEndpoint){
          cellEls[node.row][node.col].classList.add('path');
        }
        j++;
        setTimeout(stepPath, Math.max(6, delay/1.5));
      }
      stepPath();
    }

    stepVisit();
  }

  function clearPath(){
    if(running) return;
    clearPathVisuals();
    setStatus('Path cleared. Walls and terrain are untouched.');
  }

  function clearBoard(){
    if(running) return;
    buildGrid();
    refreshAll();
    setStatus('Board cleared. Drag from the green node to the red node, or draw walls and terrain.');
  }

  visualizeBtn.addEventListener('click', visualize);
  clearPathBtn.addEventListener('click', clearPath);
  clearBoardBtn.addEventListener('click', clearBoard);

  // init
  buildGrid();
  buildBoardDOM();
  refreshAll();
})();
