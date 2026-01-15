import { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/** ---------------- Utils ---------------- */

const EPS = 1e-6;
const nearlyEqual = (a, b, eps = EPS) => Math.abs(a - b) <= eps;

function parseMaybeNumber(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ---------------- Graph evaluation (CONNECTED sums) ---------------- */

function getManualSourceHandleValue(node, handleId) {
  if (!node) return 0;
  const d = node.data || {};

  switch (node.type) {
    case 'sourceNode':
      return handleId === 'out' ? parseMaybeNumber(d.out) ?? 0 : 0;

    case 'mixerNode':
      return handleId === 'out' ? parseMaybeNumber(d.out) ?? 0 : 0;

    case 'splitNode':
      if (handleId === 'out1') return parseMaybeNumber(d.out1) ?? 0;
      if (handleId === 'out2') return parseMaybeNumber(d.out2) ?? 0;
      if (handleId === 'out3') return parseMaybeNumber(d.out3) ?? 0;
      return 0;

    case 'hallNode':
      if (handleId === 'out1') return parseMaybeNumber(d.out1) ?? 0;
      if (handleId === 'out2') return parseMaybeNumber(d.out2) ?? 0;
      if (handleId === 'out3') return parseMaybeNumber(d.out3) ?? 0;
      return 0;

    default:
      return 0;
  }
}

function computeConnectedIncoming(nodes, edges) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const incomingByNode = new Map(); // targetNodeId -> { handleId: sum }

  for (const e of edges) {
    const src = nodeById.get(e.source);
    const val = getManualSourceHandleValue(src, e.sourceHandle);
    const targetHandle = e.targetHandle || 'in';

    if (!incomingByNode.has(e.target)) incomingByNode.set(e.target, {});
    const acc = incomingByNode.get(e.target);
    acc[targetHandle] = (acc[targetHandle] || 0) + val;
  }

  return incomingByNode;
}

/** ---------------- UI helpers ---------------- */

function WarningLine({ show, children }) {
  if (!show) return null;
  return <div style={{ marginTop: 6, color: '#b00020' }}>{children}</div>;
}

function OkLine({ show, children }) {
  if (!show) return null;
  return <div style={{ marginTop: 6, color: '#2e7d32' }}>{children}</div>;
}

function HandleLabel({ side, top, text }) {
  const base = {
    position: 'absolute',
    top,
    fontSize: 10,
    color: '#333',
    background: '#fff',
    padding: '1px 4px',
    border: '1px solid #ddd',
    borderRadius: 6,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  };
  const style = side === 'left' ? { ...base, left: -48 } : { ...base, right: -54 };
  return <div style={style}>{text}</div>;
}

function NodeFrame({ children, minWidth = 300 }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: 10,
        borderRadius: 8,
        border: '1px solid #555',
        background: '#fff',
        minWidth,
      }}
    >
      {children}
    </div>
  );
}

function TwoCols({ leftTitle, rightTitle, left, right }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{leftTitle}</div>
        {left}
      </div>
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{rightTitle}</div>
        {right}
      </div>
    </div>
  );
}

/** ---------------- Nodes (two-column layout) ---------------- */

function SourceNode({ id, data }) {
  const outManual = parseMaybeNumber(data.out) ?? 0;

  return (
    <NodeFrame minWidth={260}>
      <Handle type="source" position={Position.Right} id="out" />
      <HandleLabel side="right" top="46%" text="out" />

      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Source ({id})</div>

      <TwoCols
        leftTitle="IN"
        rightTitle="OUT (manual)"
        left={<div style={{ fontSize: 12, color: '#666' }}>—</div>}
        right={
          <div style={{ fontSize: 12 }}>
            <div>
              out{' '}
              <input
                type="number"
                value={data.out ?? ''}
                onChange={(e) => data.setOut?.(e.target.value)}
                style={{ width: 90 }}
              />
            </div>
            <div style={{ marginTop: 8, fontWeight: 'bold' }}>{outManual} m³/h</div>
          </div>
        }
      />
    </NodeFrame>
  );
}

function MixerNode({ id, data }) {
  const cin1 = Number(data.cin1) || 0;
  const cin2 = Number(data.cin2) || 0;

  const min1 = parseMaybeNumber(data.in1);
  const min2 = parseMaybeNumber(data.in2);
  const mout = parseMaybeNumber(data.out);

  const in1Ref = min1 != null ? min1 : cin1;
  const in2Ref = min2 != null ? min2 : cin2;
  const computedOut = in1Ref + in2Ref;

  const mismatchIn1 = min1 != null && !nearlyEqual(min1, cin1);
  const mismatchIn2 = min2 != null && !nearlyEqual(min2, cin2);
  const mismatchOut = mout != null && !nearlyEqual(mout, computedOut);

  const outRef = mout != null ? mout : computedOut;
  const balanceOk = nearlyEqual(outRef, computedOut);

  return (
    <NodeFrame minWidth={340}>
      <Handle type="target" position={Position.Left} id="in1" style={{ top: '30%' }} />
      <Handle type="target" position={Position.Left} id="in2" style={{ top: '70%' }} />
      <HandleLabel side="left" top="26%" text="in1" />
      <HandleLabel side="left" top="66%" text="in2" />

      <Handle type="source" position={Position.Right} id="out" />
      <HandleLabel side="right" top="46%" text="out" />

      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Mixer ({id})</div>

      <TwoCols
        leftTitle="IN"
        rightTitle="OUT"
        left={
          <div style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 6, color: '#555' }}>Connected</div>
            <div>cin1 = {cin1}</div>
            <div>cin2 = {cin2}</div>

            <div style={{ marginTop: 10, marginBottom: 6, color: '#555' }}>Manual (optional)</div>
            <div>
              in1{' '}
              <input
                type="number"
                value={data.in1 ?? ''}
                onChange={(e) => data.setIn1?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              in2{' '}
              <input
                type="number"
                value={data.in2 ?? ''}
                onChange={(e) => data.setIn2?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>

            <WarningLine show={mismatchIn1}>⚠ in1 mismatch</WarningLine>
            <WarningLine show={mismatchIn2}>⚠ in2 mismatch</WarningLine>
          </div>
        }
        right={
          <div style={{ fontSize: 12 }}>
            <div>Computed out = {computedOut}</div>

            <div style={{ marginTop: 10 }}>
              Manual out (optional){' '}
              <input
                type="number"
                value={data.out ?? ''}
                onChange={(e) => data.setOut?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>

            <WarningLine show={mismatchOut}>⚠ out mismatch</WarningLine>
            <OkLine show={balanceOk}>✓ Balanced</OkLine>
            <WarningLine show={!balanceOk}>⚠ Not balanced</WarningLine>
          </div>
        }
      />
    </NodeFrame>
  );
}

function SplitNode({ id, data }) {
  const cin = Number(data.cin) || 0;

  const min = parseMaybeNumber(data.in);
  const mout1 = parseMaybeNumber(data.out1);
  const mout2 = parseMaybeNumber(data.out2);
  const mout3 = parseMaybeNumber(data.out3);

  const inRef = min != null ? min : cin;

  const out1 = mout1 ?? 0;
  const out2 = mout2 ?? 0;
  const out3 = mout3 ?? 0;
  const sumOut = out1 + out2 + out3;

  const mismatchIn = min != null && !nearlyEqual(min, cin);
  const allOutSpecified = mout1 != null && mout2 != null && mout3 != null;
  const balanceOk = nearlyEqual(inRef, sumOut);

  return (
    <NodeFrame minWidth={360}>
      <Handle type="target" position={Position.Left} id="in" />
      <HandleLabel side="left" top="46%" text="in" />

      <Handle type="source" position={Position.Right} id="out1" style={{ top: '25%' }} />
      <Handle type="source" position={Position.Right} id="out2" style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} id="out3" style={{ top: '75%' }} />
      <HandleLabel side="right" top="21%" text="out1" />
      <HandleLabel side="right" top="46%" text="out2" />
      <HandleLabel side="right" top="71%" text="out3" />

      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Split ({id})</div>

      <TwoCols
        leftTitle="IN"
        rightTitle="OUT (manual)"
        left={
          <div style={{ fontSize: 12 }}>
            <div style={{ color: '#555', marginBottom: 6 }}>Connected</div>
            <div>cin = {cin}</div>

            <div style={{ marginTop: 10, color: '#555', marginBottom: 6 }}>Manual (optional)</div>
            <div>
              in{' '}
              <input
                type="number"
                value={data.in ?? ''}
                onChange={(e) => data.setIn?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <WarningLine show={mismatchIn}>⚠ in mismatch</WarningLine>
          </div>
        }
        right={
          <div style={{ fontSize: 12 }}>
            <div>
              out1{' '}
              <input
                type="number"
                value={data.out1 ?? ''}
                onChange={(e) => data.setOut1?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              out2{' '}
              <input
                type="number"
                value={data.out2 ?? ''}
                onChange={(e) => data.setOut2?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              out3{' '}
              <input
                type="number"
                value={data.out3 ?? ''}
                onChange={(e) => data.setOut3?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>

            <div style={{ marginTop: 10, fontWeight: 'bold' }}>Σout = {sumOut}</div>

            <WarningLine show={!allOutSpecified}>⚠ Fill out1/out2/out3 for strict check</WarningLine>
            <OkLine show={allOutSpecified && balanceOk}>✓ Balanced (in = Σout)</OkLine>
            <WarningLine show={allOutSpecified && !balanceOk}>⚠ Not balanced</WarningLine>
          </div>
        }
      />
    </NodeFrame>
  );
}

function HallNode({ id, data }) {
  const volume = parseMaybeNumber(data.volume) ?? 0;

  const cin1 = Number(data.cin1) || 0;
  const cin2 = Number(data.cin2) || 0;
  const cin3 = Number(data.cin3) || 0;
  const connectedInSum = cin1 + cin2 + cin3;

  const in1m = parseMaybeNumber(data.in1);
  const in2m = parseMaybeNumber(data.in2);
  const in3m = parseMaybeNumber(data.in3);

  const in1Ref = in1m != null ? in1m : cin1;
  const in2Ref = in2m != null ? in2m : cin2;
  const in3Ref = in3m != null ? in3m : cin3;
  const inRefSum = in1Ref + in2Ref + in3Ref;

  const out1 = parseMaybeNumber(data.out1) ?? 0;
  const out2 = parseMaybeNumber(data.out2) ?? 0;
  const out3 = parseMaybeNumber(data.out3) ?? 0;
  const outSum = out1 + out2 + out3;

  const ach = volume > 0 ? outSum / volume : 0;

  const mismatchIn1 = in1m != null && !nearlyEqual(in1m, cin1);
  const mismatchIn2 = in2m != null && !nearlyEqual(in2m, cin2);
  const mismatchIn3 = in3m != null && !nearlyEqual(in3m, cin3);

  const balanceOk = nearlyEqual(inRefSum, outSum);

  return (
    <NodeFrame minWidth={420}>
      <Handle type="target" position={Position.Left} id="in1" style={{ top: '22%' }} />
      <Handle type="target" position={Position.Left} id="in2" style={{ top: '45%' }} />
      <Handle type="target" position={Position.Left} id="in3" style={{ top: '68%' }} />
      <HandleLabel side="left" top="18%" text="in1" />
      <HandleLabel side="left" top="41%" text="in2" />
      <HandleLabel side="left" top="64%" text="in3" />

      <Handle type="source" position={Position.Right} id="out1" style={{ top: '22%' }} />
      <Handle type="source" position={Position.Right} id="out2" style={{ top: '45%' }} />
      <Handle type="source" position={Position.Right} id="out3" style={{ top: '68%' }} />
      <HandleLabel side="right" top="18%" text="out1" />
      <HandleLabel side="right" top="41%" text="out2" />
      <HandleLabel side="right" top="64%" text="out3" />

      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Hall ({id})</div>

      <div style={{ fontSize: 12, marginBottom: 8 }}>
        Volume (m³){' '}
        <input
          type="number"
          value={data.volume ?? ''}
          onChange={(e) => data.setVolume?.(e.target.value)}
          style={{ width: 90 }}
        />
        <span style={{ marginLeft: 12, fontWeight: 'bold' }}>ACH = {ach.toFixed(3)} 1/h</span>
      </div>

      <TwoCols
        leftTitle="IN"
        rightTitle="OUT (manual)"
        left={
          <div style={{ fontSize: 12 }}>
            <div style={{ color: '#555', marginBottom: 6 }}>Connected</div>
            <div>cin1 = {cin1}</div>
            <div>cin2 = {cin2}</div>
            <div>cin3 = {cin3}</div>
            <div style={{ marginTop: 8, fontWeight: 'bold' }}>Σconnected = {connectedInSum}</div>

            <div style={{ marginTop: 12, color: '#555', marginBottom: 6 }}>Manual (optional)</div>
            <div>
              in1{' '}
              <input
                type="number"
                value={data.in1 ?? ''}
                onChange={(e) => data.setIn1?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              in2{' '}
              <input
                type="number"
                value={data.in2 ?? ''}
                onChange={(e) => data.setIn2?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              in3{' '}
              <input
                type="number"
                value={data.in3 ?? ''}
                onChange={(e) => data.setIn3?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>

            <WarningLine show={mismatchIn1}>⚠ in1 mismatch</WarningLine>
            <WarningLine show={mismatchIn2}>⚠ in2 mismatch</WarningLine>
            <WarningLine show={mismatchIn3}>⚠ in3 mismatch</WarningLine>

            <div style={{ marginTop: 10, fontWeight: 'bold' }}>Σin(ref) = {inRefSum}</div>
          </div>
        }
        right={
          <div style={{ fontSize: 12 }}>
            <div>
              out1{' '}
              <input
                type="number"
                value={data.out1 ?? ''}
                onChange={(e) => data.setOut1?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              out2{' '}
              <input
                type="number"
                value={data.out2 ?? ''}
                onChange={(e) => data.setOut2?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              out3{' '}
              <input
                type="number"
                value={data.out3 ?? ''}
                onChange={(e) => data.setOut3?.(e.target.value)}
                style={{ width: 80 }}
              />
            </div>

            <div style={{ marginTop: 10, fontWeight: 'bold' }}>Σout = {outSum}</div>

            <OkLine show={balanceOk}>✓ Balanced</OkLine>
            <WarningLine show={!balanceOk}>⚠ Not balanced (Σin(ref) must equal Σout)</WarningLine>
          </div>
        }
      />
    </NodeFrame>
  );
}

function OutletNode({ id, data }) {
  const cin = Number(data.cin) || 0;
  const expected = parseMaybeNumber(data.expectedIn);

  const hasExpected = expected != null;
  const ok = !hasExpected || nearlyEqual(expected, cin);

  return (
    <NodeFrame minWidth={280}>
      <Handle type="target" position={Position.Left} id="in" />
      <HandleLabel side="left" top="46%" text="in" />

      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Sink ({id})</div>

      <TwoCols
        leftTitle="IN"
        rightTitle="OUT"
        left={
          <div style={{ fontSize: 12 }}>
            <div>Connected IN (sum): {cin}</div>
            <div style={{ marginTop: 10 }}>
              Expected IN (manual){' '}
              <input
                type="number"
                value={data.expectedIn ?? ''}
                onChange={(e) => data.setExpectedIn?.(e.target.value)}
                style={{ width: 90 }}
              />
            </div>
            <OkLine show={hasExpected && ok}>✓ Matches expected</OkLine>
            <WarningLine show={hasExpected && !ok}>⚠ Does not match expected</WarningLine>
          </div>
        }
        right={<div style={{ fontSize: 12, color: '#666' }}>—</div>}
      />
    </NodeFrame>
  );
}

/** ---------------- Node registry ---------------- */

const nodeTypes = {
  sourceNode: SourceNode,
  mixerNode: MixerNode,
  splitNode: SplitNode,
  hallNode: HallNode,
  outletNode: OutletNode,
};

/** ---------- Drag helpers ---------- */
const DND_MIME = 'application/reactflow';

function PaletteItem({ label, nodeType }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, nodeType);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        border: '1px solid #888',
        borderRadius: 8,
        padding: 10,
        cursor: 'grab',
        background: '#fff',
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  );
}

/** ---------------- App ---------------- */

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [rfInstance, setRfInstance] = useState(null);

  const idRef = useRef(1);
  const nextId = (prefix) => `${prefix}-${idRef.current++}`;

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(DND_MIME);
      if (!type || !rfInstance) return;

      const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      if (type === 'sourceNode') {
        const id = nextId('source');
        setNodes((nds) => [...nds, { id, type, position, data: { out: '' } }]);
      }

      if (type === 'mixerNode') {
        const id = nextId('mixer');
        setNodes((nds) => [...nds, { id, type, position, data: { in1: '', in2: '', out: '' } }]);
      }

      if (type === 'splitNode') {
        const id = nextId('split');
        setNodes((nds) => [...nds, { id, type, position, data: { in: '', out1: '', out2: '', out3: '' } }]);
      }

      if (type === 'hallNode') {
        const id = nextId('hall');
        setNodes((nds) => [
          ...nds,
          {
            id,
            type,
            position,
            data: {
              volume: '',
              in1: '',
              in2: '',
              in3: '',
              out1: '',
              out2: '',
              out3: '',
            },
          },
        ]);
      }

      if (type === 'outletNode') {
        const id = nextId('sink');
        setNodes((nds) => [...nds, { id, type, position, data: { expectedIn: '' } }]);
      }
    },
    [rfInstance]
  );

  const incomingByNode = useMemo(() => computeConnectedIncoming(nodes, edges), [nodes, edges]);

  const makeSetter = useCallback(
    (nodeId, key) => (val) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, [key]: val } } : n))
      );
    },
    []
  );

  const nodesWithData = useMemo(() => {
    return nodes.map((node) => {
      const inc = incomingByNode.get(node.id) || {};

      if (node.type === 'sourceNode') {
        return { ...node, data: { ...node.data, setOut: makeSetter(node.id, 'out') } };
      }

      if (node.type === 'mixerNode') {
        return {
          ...node,
          data: {
            ...node.data,
            cin1: inc.in1 || 0,
            cin2: inc.in2 || 0,
            setIn1: makeSetter(node.id, 'in1'),
            setIn2: makeSetter(node.id, 'in2'),
            setOut: makeSetter(node.id, 'out'),
          },
        };
      }

      if (node.type === 'splitNode') {
        return {
          ...node,
          data: {
            ...node.data,
            cin: inc.in || 0,
            setIn: makeSetter(node.id, 'in'),
            setOut1: makeSetter(node.id, 'out1'),
            setOut2: makeSetter(node.id, 'out2'),
            setOut3: makeSetter(node.id, 'out3'),
          },
        };
      }

      if (node.type === 'hallNode') {
        return {
          ...node,
          data: {
            ...node.data,
            cin1: inc.in1 || 0,
            cin2: inc.in2 || 0,
            cin3: inc.in3 || 0,
            setVolume: makeSetter(node.id, 'volume'),
            setIn1: makeSetter(node.id, 'in1'),
            setIn2: makeSetter(node.id, 'in2'),
            setIn3: makeSetter(node.id, 'in3'),
            setOut1: makeSetter(node.id, 'out1'),
            setOut2: makeSetter(node.id, 'out2'),
            setOut3: makeSetter(node.id, 'out3'),
          },
        };
      }

      if (node.type === 'outletNode') {
        const total = Object.values(inc).reduce((a, b) => a + (Number(b) || 0), 0);
        return {
          ...node,
          data: {
            ...node.data,
            cin: total,
            setExpectedIn: makeSetter(node.id, 'expectedIn'),
          },
        };
      }

      return node;
    });
  }, [nodes, incomingByNode, makeSetter]);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex' }}>
      <div style={{ width: 320, padding: 12, borderRight: '1px solid #ddd', background: '#f7f7f7' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Palette</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <PaletteItem label="Source" nodeType="sourceNode" />
          <PaletteItem label="Mixer" nodeType="mixerNode" />
          <PaletteItem label="Split (3 out)" nodeType="splitNode" />
          <PaletteItem label="Hall" nodeType="hallNode" />
          <PaletteItem label="Sink" nodeType="outletNode" />
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: '#555', lineHeight: 1.35 }}>
          Nodes show <b>IN on the left</b> and <b>OUT on the right</b> (handles and UI).
          <br />
          Edges do <b>not</b> overwrite manual values. You get mismatch warnings + balance checks.
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodesWithData}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
