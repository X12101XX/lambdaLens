import { useState } from 'react';

const API_BASE = 'http://localhost:3000';

const RULES = [
  { name: 'T', expr: '\\x y -> x', display: 'T = λx.λy.x' },
  { name: 'F', expr: '\\x y -> y', display: 'F = λx.λy.y' },
  { name: 'AND', expr: '\\p q -> p q p', display: '∧ = λp.λq.p q p' },
  { name: 'OR', expr: '\\p q -> p p q', display: '∨ = λp.λq.p p q' },
  { name: 'NOT', expr: '\\p -> p F T', display: '¬ = λp.p F T' },
  { name: '0', expr: '\\f x -> x', display: '0 = λf.λx.x' },
  { name: 'succ', expr: '\\n f x -> f (n f x)', display: 'succ = λn.λf.λx.f (n f x)' },
  { name: '+', expr: '\\m n -> m succ n', display: '+' },
  { name: '*', expr: '\\m n -> m (+ n) 0', display: '*' },
  { name: 'power', expr: '\\b e -> e b', display: 'power = λb.λe.e b' },
];

function App() {
  const [expr, setExpr] = useState('(\\x -> x + 1) 3');
  const [traceResult, setTraceResult] = useState(null);
  const [evalResult, setEvalResult] = useState(null);
  const [typeResult, setTypeResult] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [loading, setLoading] = useState({ trace: false, eval: false, type: false });
  const [error, setError] = useState('');

  const formatLambda = (str) => {
    if (!str) return '';
    return str.replace(/\\/g, 'λ').replace(/->/g, '→');
  };

  const unformatLambda = (str) => {
    if (!str) return '';
    return str.replace(/λ/g, '\\');
  };

  const callTrace = async () => {
    setLoading(prev => ({ ...prev, trace: true }));
    setError('');
    setSelectedStep(null);
    try {
      const res = await fetch(`${API_BASE}/api/trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr: unformatLambda(expr) }),
      });
      const data = await res.json();
      if (res.ok && data.steps) {
        setTraceResult(data);
        setSelectedStep(data.steps[0]);
      } else {
        setError(data.error || '单步归约失败');
        setTraceResult(null);
      }
    } catch (err) {
      setError('后端未启动，请运行 lambdalens.exe');
      setTraceResult(null);
    }
    setLoading(prev => ({ ...prev, trace: false }));
  };

  const callEval = async () => {
    setLoading(prev => ({ ...prev, eval: true }));
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr: unformatLambda(expr) }),
      });
      const data = await res.json();
      if (res.ok && data.value !== undefined) {
        setEvalResult(data);
      } else {
        setError(data.error || '求值失败');
        setEvalResult(null);
      }
    } catch (err) {
      setError('后端未启动，请运行 lambdalens.exe');
      setEvalResult(null);
    }
    setLoading(prev => ({ ...prev, eval: false }));
  };

  const callTypeCheck = async () => {
    setLoading(prev => ({ ...prev, type: true }));
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/typecheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr: unformatLambda(expr) }),
      });
      const data = await res.json();
      if (res.ok && data.type) {
        setTypeResult(data);
      } else {
        setError(data.error || '类型推导失败');
        setTypeResult(null);
      }
    } catch (err) {
      setError('后端未启动，请运行 lambdalens.exe');
      setTypeResult(null);
    }
    setLoading(prev => ({ ...prev, type: false }));
  };

  const insertRule = (ruleExpr) => {
    setExpr(ruleExpr);
    setTraceResult(null);
    setEvalResult(null);
    setTypeResult(null);
    setSelectedStep(null);
    setError('');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, monospace', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* 左侧边栏 - 纯白色，无边框，无阴影 */}
      <div style={{ width: '30%', minWidth: 280, maxWidth: 400, background: 'white', borderRight: 'none', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ padding: '1rem', fontSize: '1.2rem', borderBottom: 'none', color: '#667eea', fontWeight: 'bold' }}>📚 Rewrite Rules</h3>
        <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
          {RULES.map((rule, idx) => (
            <div key={rule.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem', marginBottom: '0.4rem', borderRadius: 10, background: '#f9fafb', border: 'none', cursor: 'pointer' }}
              onClick={() => insertRule(rule.expr)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem', color: '#667eea', minWidth: '2rem', fontWeight: 'bold' }}>{idx + 1}.</span>
                <code style={{ fontSize: '0.9rem', color: '#10b981', background: 'transparent' }}>{rule.display}</code>
              </div>
              <button style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'white', fontWeight: 'bold' }}>✓</button>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧主区域 */}
      <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #fff, #e0d4ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', marginBottom: '0.25rem' }}>λ · lambdaLens</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>β-归约追踪 · Hindley-Milner 类型推导</p >
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <textarea 
            value={formatLambda(expr)} 
            onChange={(e) => setExpr(unformatLambda(e.target.value))} 
            rows={2} 
            style={{ flex: 1, minWidth: 200, padding: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 12, fontFamily: 'monospace', fontSize: '0.9rem', background: 'white', color: '#1f2937', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={callTrace} disabled={loading.trace} style={{ flex: 1, padding: '0.6rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
            {loading.trace ? '...' : '📊 单步归约'}
          </button>
          <button onClick={callEval} disabled={loading.eval} style={{ flex: 1, padding: '0.6rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
            {loading.eval ? '...' : ' 直接求值'}
          </button>
          <button onClick={callTypeCheck} disabled={loading.type} style={{ flex: 1, padding: '0.6rem', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
            {loading.type ? '...' : '🔧 类型推导'}
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.8rem', borderRadius: 10, marginBottom: '1rem' }}> {error}</div>}

        {traceResult && (
          <div style={{ background: 'white', borderRadius: 16, padding: '1rem', marginBottom: '1rem', border: 'none', boxShadow: 'none' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#3b82f6' }}>📊 单步归约</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem', maxHeight: 300, overflow: 'auto' }}>
              {traceResult.steps?.map((step, idx) => (
                <div key={idx} onClick={() => setSelectedStep(step)} style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.85rem', background: selectedStep?.index === step.index ? '#e0e7ff' : '#f9fafb', borderRadius: 8, cursor: 'pointer', border: 'none' }}>
                  {step.index}. {formatLambda(step.exprs)} : {step.type}
                  {step.rule && <span style={{ color: '#8b5cf6', marginLeft: '0.5rem', fontSize: '0.7rem' }}>→ {step.rule}</span>}
                </div>
              ))}
            </div>
            {selectedStep && (
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '1rem', border: 'none' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#10b981' }}>📌 当前步骤详情</div>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace', marginBottom: '0.3rem' }}>{formatLambda(selectedStep.exprs)}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>类型: <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{selectedStep.type}</span>{selectedStep.rule && <span style={{ marginLeft: '1rem' }}>规则: {selectedStep.rule}</span>}</div>
              </div>
            )}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: 'none', color: '#10b981', fontWeight: 'bold' }}>最终类型: {traceResult.type}</div>
          </div>
        )}

        {evalResult && (
          <div style={{ background: 'white', borderRadius: 16, padding: '1rem', marginBottom: '1rem', border: 'none', boxShadow: 'none' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#10b981' }}> 直接求值</div>
            <div style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}>结果: {evalResult.value}</div>
            <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.3rem' }}>类型: {evalResult.type}</div>
          </div>
        )}

        {typeResult && (
          <div style={{ background: 'white', borderRadius: 16, padding: '1rem', marginBottom: '1rem', border: 'none', boxShadow: 'none' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#8b5cf6' }}>🔧 类型推导</div>
            <div style={{ fontSize: '1.1rem', fontFamily: 'monospace' }}>{formatLambda(expr)} : {typeResult.type}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;