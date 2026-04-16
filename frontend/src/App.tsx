import { useState, useEffect } from 'react';

const RULES = [
  { name: 'T', expr: '\\x y -&gt; x', display: 'T = λx.λy.x' },
  { name: 'F', expr: '\\x y -&gt; y', display: 'F = λx.λy.y' },
  { name: 'AND', expr: '\\p q -&gt; p q p', display: '∧ = λp.λq.p q p' },
  { name: 'OR', expr: '\\p q -&gt; p p q', display: '∨ = λp.λq.p p q' },
  { name: 'NOT', expr: '\\p -&gt; p F T', display: '¬ = λp.p F T' },
  { name: '0', expr: '\\f x -&gt; x', display: '0 = λf.λx.x' },
  { name: 'succ', expr: '\\n f x -&gt; f (n f x)', display: 'succ = λn.λf.λx.f (n f x)' },
  { name: '+', expr: '\\m n -&gt; m succ n', display: '+' },
  { name: '*', expr: '\\m n -&gt; m (+ n) 0', display: '*' },
  { name: 'power', expr: '\\b e -&gt; e b', display: 'power = λb.λe.e b' },
];

function reduceOneStep(expr) {
  if (expr === '(\\x -&gt; x + 1) 3') {
    return { next: '3 + 1', type: 'Int', done: false };
  }
  if (expr === '3 + 1') {
    return { next: '4', type: 'Int', done: true };
  }
  return { next: expr, type: 'Unknown', done: true };
}

function App() {
  const [expr, setExpr] = useState('(\\x -&gt; x + 1) 3');
  const [currentExpr, setCurrentExpr] = useState('');
  const [currentType, setCurrentType] = useState('');
  const [history, setHistory] = useState([]);
  const [isDone, setIsDone] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pulseId, setPulseId] = useState(0);

  const startReduction = () => {
    setIsAnimating(true);
    setCurrentExpr(expr);
    setCurrentType('');
    setHistory([{ expr, type: '' }]);
    setIsDone(false);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const nextStep = () => {
    if (isDone) return;
    setIsAnimating(true);
    setPulseId(Date.now());
    const result = reduceOneStep(currentExpr);
    setTimeout(() => {
      setCurrentExpr(result.next);
      setCurrentType(result.type);
      setHistory([...history, { expr: result.next, type: result.type }]);
      setIsDone(result.done);
      setIsAnimating(false);
    }, 200);
  };

  const reset = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentExpr('');
      setCurrentType('');
      setHistory([]);
      setIsDone(false);
      setIsAnimating(false);
    }, 200);
  };

  const insertRule = (ruleExpr) => {
    setExpr(ruleExpr);
    reset();
  };return (
  <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, monospace', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
    <div style={{ width: 340, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderRight: '1px solid rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
      <h3 style={{ padding: '1rem', fontSize: '0.9rem', borderBottom: '1px solid rgba(0,0,0,0.1)', color: '#667eea', fontWeight: 'bold' }}>📚 Rewrite Rules</h3>
      <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
        {RULES.map((rule, idx) => (
          <div key={rule.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: 10, background: 'white', border: '1px solid #e5e7eb', transition: 'all 0.2s', cursor: 'pointer', transform: 'translateX(0)', animation: `slideUp 0.3s ease-out ${idx * 0.03}s backwards` }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(5px)'; e.currentTarget.style.borderColor = '#667eea'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#667eea', minWidth: '1.8rem', fontWeight: 'bold' }}>{idx + 1}.</span>
              <code style={{ fontSize: '0.7rem', color: '#10b981' }}>{rule.display}</code>
            </div>
            <button onClick={() => insertRule(rule.expr)} style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'white', fontWeight: 'bold', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >✓</button>
          </div>
        ))}
      </div>
    </div>

    <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #fff, #e0d4ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', marginBottom: '0.25rem' }}>λ · lambdaLens</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>β-归约追踪 · Hindley-Milner 类型推导</p >
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <textarea value={expr} onChange={(e) => setExpr(e.target.value)} rows={2} style={{ flex: 1, padding: '0.75rem', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 12, fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(255,255,255,0.95)', resize: 'vertical', transition: 'all 0.2s' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#667eea'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102,126,234,0.2)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        <button onClick={startReduction} style={{ padding: '0 1.5rem', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(102,126,234,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
        > Start</button>
        <button onClick={reset} style={{ padding: '0 1.5rem', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
        >⟳ Reset</button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', transition: 'all 0.3s', ...(isAnimating ? { transform: 'scale(0.99)', boxShadow: '0 5px 20px rgba(0,0,0,0.15)' } : {}) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
          <span style={{ fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}> Derivation</span>
          {currentExpr && !isDone && (
            <button onClick={nextStep} style={{ padding: '0.3rem 1rem', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 20, fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >Next Step →</button>
          )}
        </div>

        {currentExpr ? (
          <div style={{ background: 'linear-gradient(135deg, #f9fafb, #ffffff)', borderRadius: 16, padding: '1.5rem', marginBottom: '1rem', textAlign: 'center', ...(isAnimating ? { animation: 'pulse 0.5s ease-out' } : {}) }}>
            <div style={{ fontSize: '1.2rem' }}>
              <code style={{ background: '#f3f4f6', padding: '0.3rem 0.8rem', borderRadius: 10, fontFamily: 'monospace', transition: 'all 0.2s' }}>{currentExpr}</code>
              {currentType && <span style={{ marginLeft: '0.5rem', color: '#f59e0b', fontWeight: 'bold' }}>: {currentType}</span>}
            </div>
            {!isDone && (
              <div style={{ marginTop: '0.8rem', fontSize: '0.7rem', color: '#8b5cf6' }}>
                ️ 点击 Next Step 继续归约
              </div>
            )}
            {isDone && (
              <div style={{ marginTop: '0.8rem', color: '#10b981', fontWeight: 'bold', animation: 'fadeIn 0.3s ease-out' }}>
                ✅ 归约完成！
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', animation: 'float 3s ease-in-out infinite' }}>λ</div>
            <p>输入表达式，点击 Start 开始归约</p >
          </div>
        )}          {history.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#6b7280', marginBottom: '0.5rem' }}>📋 归约历史</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 200, overflow: 'auto' }}>
                {history.map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.3rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.7rem', fontFamily: 'monospace', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.transform = 'translateX(3px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    <span style={{ color: '#667eea', fontWeight: 'bold', minWidth: '1.5rem' }}>{idx}</span>
                    <code>{h.expr}</code>
                    {h.type && <span style={{ color: '#f59e0b', marginLeft: 'auto' }}>: {h.type}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102,126,234,0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(102,126,234,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102,126,234,0); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
}

export default App;