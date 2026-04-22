import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

type Rule = {
  name: string;
  expr: string;
  display: string;
  preset: boolean;
};

type TraceStep = {
  index: number;
  exprs: string;
  type?: string;
  rule?: string | null;
};

type TraceResult = {
  steps: TraceStep[];
  type?: string | null;
};

type EvalResult = {
  value: string;
  type?: string;
};

type TypeResult = {
  type: string;
};

type LoadingState = {
  trace: boolean;
  eval: boolean;
  type: boolean;
};

const PRESET_RULES: Rule[] = [
  { name: 'T', expr: '\\x y -> x', display: 'T = λx.λy.x', preset: true },
  { name: 'F', expr: '\\x y -> y', display: 'F = λx.λy.y', preset: true },
  { name: 'AND', expr: '\\p q -> p q p', display: '∧ = λp.λq.p q p', preset: true },
  { name: 'OR', expr: '\\p q -> p p q', display: '∨ = λp.λq.p p q', preset: true },
  { name: 'NOT', expr: '\\p -> p F T', display: '¬ = λp.p F T', preset: true },
  { name: '0', expr: '\\f x -> x', display: '0 = λf.λx.x', preset: true },
  { name: 'succ', expr: '\\n f x -> f (n f x)', display: 'succ = λn.λf.λx.f (n f x)', preset: true },
  { name: '+', expr: '\\m n -> m succ n', display: '+', preset: true },
  { name: '*', expr: '\\m n -> m (+ n) 0', display: '*', preset: true },
  { name: 'power', expr: '\\b e -> e b', display: 'power = λb.λe.e b', preset: true },
];

function App() {
  const [expr, setExpr] = useState('(\\x -> x + 1) 3');
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [typeResult, setTypeResult] = useState<TypeResult | null>(null);
  const [selectedStep, setSelectedStep] = useState<TraceStep | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ trace: false, eval: false, type: false });
  const [error, setError] = useState('');
  
  const [rules, setRules] = useState<Rule[]>(() => {
    const saved = localStorage.getItem('lambdaLens_customRules');
    const custom: Rule[] = saved ? JSON.parse(saved) : [];
    return [...PRESET_RULES, ...custom];
  });
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleExpr, setNewRuleExpr] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);

  useEffect(() => {
    const customRules = rules.filter(r => !r.preset);
    localStorage.setItem('lambdaLens_customRules', JSON.stringify(customRules));
  }, [rules]);

  const escapeRegExp = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const expandRules = (input: string): string => {
    let result = input;
    const sortedRules = [...rules].sort((a, b) => b.name.length - a.name.length);
    for (const rule of sortedRules) {
      const regex = new RegExp(`\\b${escapeRegExp(rule.name)}\\b`, 'g');
      result = result.replace(regex, `(${rule.expr})`);
    }
    return result;
  };

  const toBackend = (str: string): string => {
    if (!str) return '';
    return str.replace(/λ/g, '\\');
  };

  const formatArrow = (str: string): string => {
    if (!str) return '';
    return str.replace(/->/g, '→');
  };

  const readErrorMessage = async (res: Response): Promise<string> => {
    const raw = (await res.text()).trim();
    if (!raw) {
      return `HTTP ${res.status}`;
    }
    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error;
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      return raw;
    }
    return raw;
  };

  const callTrace = async () => {
    if (!expr.trim()) {
      setError('请输入表达式');
      return;
    }
    setLoading(prev => ({ ...prev, trace: true }));
    setError('');
    setTraceResult(null);
    setSelectedStep(null);
    const expanded = expandRules(expr);
    try {
      const res = await fetch(`${API_BASE}/api/trace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr: toBackend(expanded) }),
      });
      if (!res.ok) {
        const backendError = await readErrorMessage(res);
        setError(`单步归约失败: ${backendError}`);
        return;
      }

      const data = (await res.json()) as {
        steps?: Array<{
          index?: number;
          exprs?: string;
          expr?: string;
          type?: string;
          rule?: string | null;
        }>;
        type?: string | null;
      };
      const normalizedSteps = Array.isArray(data.steps)
        ? data.steps.map((step, index): TraceStep => ({
            index: step.index ?? index,
            exprs: step.exprs ?? step.expr ?? '',
            type: step.type,
            rule: step.rule,
          }))
        : [];

      if (normalizedSteps.length > 0 && normalizedSteps[0].exprs) {
        setTraceResult({ ...data, steps: normalizedSteps });
        setSelectedStep(normalizedSteps[0]);
      } else {
        setError('单步归约失败: 后端返回空步骤');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      setError(`单步归约失败: ${message}`);
    } finally {
      setLoading(prev => ({ ...prev, trace: false }));
    }
  };

  const callEval = async () => {
    setLoading(prev => ({ ...prev, eval: true }));
    setError('');
    setEvalResult(null);
    const expanded = expandRules(expr);
    try {
      const res = await fetch(`${API_BASE}/api/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr: toBackend(expanded) }),
      });

      if (!res.ok) {
        const backendError = await readErrorMessage(res);
        setError(`求值失败: ${backendError}`);
        return;
      }

      const data = (await res.json()) as { value?: unknown; type?: unknown };
      if (data.value !== undefined) {
        setEvalResult({
          value: String(data.value),
          type: typeof data.type === 'string' ? data.type : undefined,
        });
      } else {
        setError('求值失败: 后端返回结果为空');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      setError(`求值失败: ${message}`);
    } finally {
      setLoading(prev => ({ ...prev, eval: false }));
    }
  };

  const callTypeCheck = async () => {
    setLoading(prev => ({ ...prev, type: true }));
    setError('');
    setTypeResult(null);
    const expanded = expandRules(expr);
    try {
      const res = await fetch(`${API_BASE}/api/typecheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr: toBackend(expanded) }),
      });

      if (!res.ok) {
        const backendError = await readErrorMessage(res);
        setError(`类型推导失败: ${backendError}`);
        return;
      }

      const data = (await res.json()) as { type?: unknown };
      if (typeof data.type === 'string') {
        setTypeResult({ type: data.type });
      } else {
        setError('类型推导失败: 后端返回类型为空');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      setError(`类型推导失败: ${message}`);
    } finally {
      setLoading(prev => ({ ...prev, type: false }));
    }
  };

  const insertRule = (ruleExpr: string): void => {
    setExpr(ruleExpr);
    setTraceResult(null);
    setEvalResult(null);
    setTypeResult(null);
    setSelectedStep(null);
    setError('');
  };

  const addCustomRule = () => {
    if (newRuleName.trim() && newRuleExpr.trim()) {
      const newRule = { 
        name: newRuleName.trim(), 
        expr: newRuleExpr.trim(), 
        display: `${newRuleName.trim()} = ${newRuleExpr.trim()}`,
        preset: false
      };
      setRules([...rules, newRule]);
      setNewRuleName('');
      setNewRuleExpr('');
      setShowAddRule(false);
    }
  };

  const deleteCustomRule = (index: number): void => {
    const newRules = [...rules];
    const rule = newRules[index];
    if (rule.preset) return;
    newRules.splice(index, 1);
    setRules(newRules);
  };

  return (
    <div style={{ 
      display: 'flex', 
      width: '100%', 
      minHeight: '100vh', 
      overflowX: 'hidden',
      fontFamily: 'system-ui, monospace', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      margin: 0, 
      padding: 0 
    }}>
      <div style={{ 
        flex: '0 0 280px', 
        background: 'white', 
        borderRight: '1px solid rgba(0,0,0,0.08)', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'auto' 
      }}>
        <h3 style={{ padding: '0.75rem', fontSize: '0.9rem', borderBottom: '1px solid #e5e7eb', color: '#667eea', fontWeight: 'bold' }}>📚 实例</h3>
        <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
          {rules.map((rule, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem', marginBottom: '0.3rem', borderRadius: 6, background: '#f9fafb', cursor: 'pointer' }}
              onClick={() => insertRule(rule.expr)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                <span style={{ fontSize: '0.7rem', color: '#667eea', minWidth: '1.5rem', fontWeight: 'bold' }}>{idx + 1}.</span>
                <code style={{ fontSize: '0.7rem', color: '#10b981', background: 'transparent' }}>{rule.display}</code>
              </div>
              {!rule.preset && (
                <button style={{ width: 24, height: 24, background: '#ef4444', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
                  onClick={(e) => { e.stopPropagation(); deleteCustomRule(idx); }}>✗</button>
              )}
              {rule.preset && (
                <button style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'white', fontWeight: 'bold' }}>✓</button>
              )}
            </div>
          ))}
          {showAddRule ? (
            <div style={{ padding: '0.4rem', background: '#f9fafb', borderRadius: 6, marginTop: '0.3rem' }}>
              <input 
                type="text" 
                placeholder="规则名称 (如: add1)" 
                value={newRuleName} 
                onChange={(e) => setNewRuleName(e.target.value)} 
                style={{ width: '100%', padding: '0.3rem', marginBottom: '0.3rem', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.75rem' }} 
              />
              <input 
                type="text" 
                placeholder="λ表达式 (如: \x -> x + 1)" 
                value={newRuleExpr} 
                onChange={(e) => setNewRuleExpr(e.target.value)} 
                style={{ width: '100%', padding: '0.3rem', marginBottom: '0.3rem', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.75rem' }} 
              />
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button onClick={addCustomRule} style={{ flex: 1, padding: '0.3rem', background: '#10b981', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>保存</button>
                <button onClick={() => setShowAddRule(false)} style={{ flex: 1, padding: '0.3rem', background: '#6b7280', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>取消</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddRule(true)} style={{ width: '100%', padding: '0.3rem', background: '#667eea', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>+ 添加规则</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '1rem', overflow: 'auto' }}>
        <div style={{ marginBottom: '0.8rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #fff, #e0d4ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', marginBottom: '0.2rem' }}>λ · lambdaLens</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>β-归约追踪 · Hindley-Milner 类型推导</p >
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
          <textarea 
            value={expr} 
            onChange={(e) => setExpr(e.target.value)} 
            rows={2} 
            style={{ flex: 1, minWidth: 180, padding: '0.5rem', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 8, fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(255,255,255,0.95)', color: '#1f2937', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
          <button onClick={callTrace} disabled={loading.trace} style={{ flex: 1, padding: '0.4rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 6, color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
            {loading.trace ? '...' : '📊 单步归约'}
          </button>
          <button onClick={callEval} disabled={loading.eval} style={{ flex: 1, padding: '0.4rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: 6, color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
            {loading.eval ? '...' : ' 直接求值'}
          </button>
          <button onClick={callTypeCheck} disabled={loading.type} style={{ flex: 1, padding: '0.4rem', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: 6, color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
            {loading.type ? '...' : '🔧 类型推导'}
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.5rem', borderRadius: 6, marginBottom: '0.8rem', fontSize: '0.75rem' }}> {error}</div>}

        {traceResult && (
          <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '0.6rem', marginBottom: '0.8rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#3b82f6' }}>📊 单步归约</div>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {traceResult.steps?.map((step, idx) => (
                <div key={idx} onClick={() => setSelectedStep(step)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', background: selectedStep?.index === step.index ? '#e0e7ff' : '#f9fafb', borderRadius: 4, cursor: 'pointer' }}>
                  {step.index}. {formatArrow(step.exprs || '?')} : {step.type}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.3rem', color: '#10b981', fontWeight: 'bold' }}>最终类型: {traceResult.type}</div>
          </div>
        )}

        {evalResult && (
          <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '0.6rem', marginBottom: '0.8rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#10b981' }}> 直接求值</div>
            <div>结果: {evalResult.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>类型: {evalResult.type}</div>
          </div>
        )}

        {typeResult && (
          <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '0.6rem', marginBottom: '0.8rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#8b5cf6' }}>🔧 类型推导</div>
            <div>{formatArrow(expr)} : {typeResult.type}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;