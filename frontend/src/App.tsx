import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const RESERVED_OPS = ['+', '-', '*', '/', '==', '<', '>', '&&', '||', '!'];

type Rule = {
  name: string;
  expr: string;
  display: string;
};

type TraceStep = {
  index: number;
  expr: string;
  type?: string;
  rule?: string | null;
};

type TraceResult = {
  steps: TraceStep[];
  type?: string | null;
  inputExpr: string;
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

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toBackend = (str: string): string => str.replace(/λ/g, '\\').replace(/→/g, '->');

const readErrorMessage = async (res: Response): Promise<string> => {
  const raw = (await res.text()).trim();
  if (!raw) return `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
  } catch { /* ignore */ }
  return raw;
};

async function apiCall(endpoint: string, expr: string): Promise<ApiResponse<Record<string, unknown>>> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr }),
  });

  if (!res.ok) {
    return { ok: false, error: await readErrorMessage(res) };
  }

  const data = await res.json() as Record<string, unknown>;
  return { ok: true, data };
}

const expandRules = (input: string, rules: Rule[]): string => {
  let result = input;
  const sortedRules = [...rules].sort((a, b) => b.name.length - a.name.length);
  for (const rule of sortedRules) {
    const regex = new RegExp(`\\b${escapeRegExp(rule.name)}\\b`, 'g');
    result = result.replace(regex, `(${rule.expr})`);
  }
  return result;
};

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function isReserved(name: string): boolean {
  return RESERVED_OPS.includes(name);
}

type CSSProperties = React.CSSProperties;

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    overflowX: 'hidden',
    fontFamily: 'system-ui, monospace',
    background: '#f8fafc',
    margin: 0,
    padding: 0,
  },
  main: {
    flex: 1,
    padding: '1.5rem',
    overflow: 'auto',
  },
  input: {
    flex: 1,
    minWidth: 200,
    padding: '0.8rem',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    background: 'white',
    color: '#1f2937',
    resize: 'vertical',
  },
  error: {
    background: '#fef2f2',
    color: '#ef4444',
    padding: '0.5rem',
    borderRadius: 6,
    marginBottom: '0.8rem',
    fontSize: '0.75rem',
  },
  card: {
    background: 'white',
    borderRadius: 8,
    padding: '0.8rem',
    marginBottom: '0.8rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: '0.3rem',
  },
  ruleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0.6rem',
    borderRadius: 6,
    background: '#f1f5f9',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btn: {
    border: 'none',
    borderRadius: 6,
    color: 'white',
    fontWeight: 'bold',
    fontSize: '0.75rem',
    transition: 'opacity 0.15s ease',
  },
  inputField: {
    width: '100%',
    padding: '0.4rem',
    marginBottom: '0.3rem',
    borderRadius: 4,
    border: '1px solid #e2e8f0',
    fontSize: '0.8rem',
  },
  smallBtn: {
    width: 22,
    height: 22,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.65rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

const buttonStyles: Record<string, CSSProperties> = {
  primary: { ...styles.btn, padding: '0.5rem 1rem', background: '#3b82f6', cursor: 'pointer' },
  success: { ...styles.btn, padding: '0.5rem 1rem', background: '#10b981', cursor: 'pointer' },
  purple: { ...styles.btn, padding: '0.5rem 1rem', background: '#8b5cf6', cursor: 'pointer' },
  delete: { ...styles.smallBtn, background: '#ef4444', color: 'white' },
  edit: { ...styles.smallBtn, background: '#64748b', color: 'white', marginRight: 4 },
  addRule: { ...styles.btn, width: '100%', padding: '0.4rem', background: '#667eea', cursor: 'pointer' },
  save: { ...styles.btn, flex: 1, padding: '0.4rem', background: '#10b981', cursor: 'pointer' },
  cancel: { ...styles.btn, flex: 1, padding: '0.4rem', background: '#94a3b8', cursor: 'pointer' },
  confirm: { ...styles.btn, flex: 1, padding: '0.4rem', background: '#3b82f6', cursor: 'pointer' },
};

function App() {
  const [expr, setExpr] = useState('(\\x -> x + 1) 3');
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [typeResult, setTypeResult] = useState<TypeResult | null>(null);
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [loading, setLoading] = useState<LoadingState>({ trace: false, eval: false, type: false });
  const [error, setError] = useState('');

  const [customRules, setCustomRules] = useLocalStorage<Rule[]>('lambdaLens_customRules', []);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>('lambdaLens_sidebarWidth', 260);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleExpr, setNewRuleExpr] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);
  const [editRuleIdx, setEditRuleIdx] = useState<number | null>(null);
  const [editRuleName, setEditRuleName] = useState('');
  const [editRuleExpr, setEditRuleExpr] = useState('');

  const isDraggingRef = useRef(false);
  const lastXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    lastXRef.current = e.clientX;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      setSidebarWidth((prev: number) => Math.max(200, Math.min(400, prev + delta)));
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setSidebarWidth]);

  const insertRule = useCallback((ruleExpr: string) => {
    setExpr(ruleExpr);
    setTraceResult(null);
    setEvalResult(null);
    setTypeResult(null);
    setSelectedStep(0);
    setError('');
  }, []);

  const handleAddRule = useCallback(() => {
    if (editRuleIdx !== null) {
      if (editRuleName.trim() && editRuleExpr.trim()) {
        if (isReserved(editRuleName.trim())) {
          setError(`规则名 "${editRuleName.trim()}" 是保留运算符: ${RESERVED_OPS.join(', ')}`);
          return;
        }
        setCustomRules((prev: Rule[]) => {
          const newRules = [...prev];
          newRules[editRuleIdx] = {
            name: editRuleName.trim(),
            expr: editRuleExpr.trim(),
            display: `${editRuleName.trim()} = ${editRuleExpr.trim()}`,
          };
          return newRules;
        });
        setEditRuleIdx(null);
        setEditRuleName('');
        setEditRuleExpr('');
      }
    } else {
      if (isReserved(newRuleName.trim())) {
        setError(`规则名 "${newRuleName.trim()}" 是保留运算符: ${RESERVED_OPS.join(', ')}`);
        return;
      }
      if (newRuleName.trim() && newRuleExpr.trim()) {
        const newRule: Rule = {
          name: newRuleName.trim(),
          expr: newRuleExpr.trim(),
          display: `${newRuleName.trim()} = ${newRuleExpr.trim()}`,
        };
        setCustomRules((prev: Rule[]) => [...prev, newRule]);
        setNewRuleName('');
        setNewRuleExpr('');
        setShowAddRule(false);
      }
    }
  }, [newRuleName, newRuleExpr, editRuleIdx, editRuleName, editRuleExpr, setCustomRules]);

  const deleteRule = useCallback((index: number) => {
    setCustomRules((prev: Rule[]) => prev.filter((_, i) => i !== index));
  }, [setCustomRules]);

  const startEditRule = useCallback((index: number) => {
    const rule = customRules[index];
    setEditRuleIdx(index);
    setEditRuleName(rule.name);
    setEditRuleExpr(rule.expr);
  }, [customRules]);

  const cancelEditRule = useCallback(() => {
    setEditRuleIdx(null);
    setEditRuleName('');
    setEditRuleExpr('');
  }, []);

  const callTrace = useCallback(async () => {
    if (!expr.trim()) {
      setError('请输入表达式');
      return;
    }
    setLoading((prev: LoadingState) => ({ ...prev, trace: true }));
    setError('');
    setTraceResult(null);
    setSelectedStep(0);

    const expanded = expandRules(expr, customRules);
    const currentExpr = expr;
    try {
      const result = await apiCall('/api/trace', toBackend(expanded));

      if (!result.ok || !result.data) {
        setError(`单步归约失败: ${result.error}`);
        return;
      }

      const stepsRaw = result.data.steps as Array<{ index?: number; expr?: string; type?: string; rule?: string | null }> | undefined;
      const steps = stepsRaw?.map((s, i): TraceStep => ({
        index: s.index ?? i,
        expr: s.expr ?? '',
        type: s.type,
        rule: s.rule,
      })) ?? [];

      if (steps.length > 0) {
        setTraceResult({
          steps,
          type: result.data.type as string | null | undefined,
          inputExpr: currentExpr,
        });
        setSelectedStep(1);
      } else {
        setError('单步归约失败: 后端返回空步骤');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      setError(`单步归约失败: ${message}`);
    } finally {
      setLoading((prev: LoadingState) => ({ ...prev, trace: false }));
    }
  }, [expr, customRules]);

  const callEval = useCallback(async () => {
    if (!expr.trim()) {
      setError('请输入表达式');
      return;
    }
    setLoading((prev: LoadingState) => ({ ...prev, eval: true }));
    setError('');

    const expanded = expandRules(expr, customRules);
    try {
      const result = await apiCall('/api/eval', toBackend(expanded));

      if (!result.ok || !result.data) {
        setError(`求值失败: ${result.error}`);
        return;
      }

      const data = result.data;
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
      setLoading((prev: LoadingState) => ({ ...prev, eval: false }));
    }
  }, [expr, customRules]);

  const callTypeCheck = useCallback(async () => {
    if (!expr.trim()) {
      setError('请输入表达式');
      return;
    }
    setLoading((prev: LoadingState) => ({ ...prev, type: true }));
    setError('');

    const expanded = expandRules(expr, customRules);
    try {
      const result = await apiCall('/api/typecheck', toBackend(expanded));

      if (!result.ok || !result.data) {
        setError(`类型推导失败: ${result.error}`);
        return;
      }

      const data = result.data;
      if (typeof data.type === 'string') {
        setTypeResult({ type: data.type });
      } else {
        setError('类型推导失败: 后端返回类型为空');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      setError(`类型推导失败: ${message}`);
    } finally {
      setLoading((prev: LoadingState) => ({ ...prev, type: false }));
    }
  }, [expr, customRules]);

  const selectedStepData = useMemo(() => {
    if (!traceResult) return null;
    return traceResult.steps.find(s => s.index === selectedStep);
  }, [traceResult, selectedStep]);

  return (
    <div style={styles.container}>
      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          maxWidth: sidebarWidth,
          background: 'white',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>实例</h2>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>点击使用表达式</p>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem' }}>
          {customRules.length > 0 ? (
            <div style={{ marginBottom: '0.75rem' }}>
              {customRules.map((rule, idx) => (
                <div key={idx}>
                  {editRuleIdx === idx ? (
                    <div style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: 6 }}>
                      <input
                        type="text"
                        placeholder="名称"
                        value={editRuleName}
                        onChange={(e) => setEditRuleName(e.target.value)}
                        style={styles.inputField}
                      />
                      <input
                        type="text"
                        placeholder="表达式"
                        value={editRuleExpr}
                        onChange={(e) => setEditRuleExpr(e.target.value)}
                        style={styles.inputField}
                      />
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={handleAddRule} style={buttonStyles.confirm}>保存</button>
                        <button onClick={cancelEditRule} style={buttonStyles.cancel}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => insertRule(rule.expr)}
                      style={styles.ruleItem}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#e2e8f0'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f1f5f9'; }}
                    >
                      <code style={{ fontSize: '0.75rem', color: '#334155', flex: 1 }}>{rule.display}</code>
                      <div style={{ display: 'flex' }}>
                        <button
                          style={buttonStyles.edit}
                          onClick={(e) => { e.stopPropagation(); startEditRule(idx); }}
                          aria-label="编辑规则"
                        >e</button>
                        <button
                          style={buttonStyles.delete}
                          onClick={(e) => { e.stopPropagation(); deleteRule(idx); }}
                          aria-label="删除规则"
                        >x</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
              暂无自定义规则
            </div>
          )}

          {showAddRule ? (
            <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: 6, marginTop: '0.3rem' }}>
              <input
                type="text"
                placeholder="名称 (如: add1)"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                style={styles.inputField}
              />
              <input
                type="text"
                placeholder="表达式 (如: \x -> x + 1)"
                value={newRuleExpr}
                onChange={(e) => setNewRuleExpr(e.target.value)}
                style={styles.inputField}
              />
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button onClick={handleAddRule} style={buttonStyles.save}>保存</button>
                <button onClick={() => { setShowAddRule(false); setNewRuleName(''); setNewRuleExpr(''); }} style={buttonStyles.cancel}>取消</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddRule(true)} style={buttonStyles.addRule}>+ 新建规则</button>
          )}
        </div>

        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: 6,
            cursor: 'ew-resize',
            background: 'transparent',
            zIndex: 10,
          }}
        />
      </aside>

      <main style={styles.main}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#667eea', marginBottom: '0.25rem' }}>
            lambdaLens
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>beta 归约追踪 · Hindley-Milner 类型推导</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <textarea
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            rows={2}
            style={styles.input}
            aria-label="输入表达式"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={callTrace} disabled={loading.trace} style={{ ...buttonStyles.primary, opacity: loading.trace ? 0.6 : 1 }}>
            {loading.trace ? '...' : '单步归约'}
          </button>
          <button onClick={callEval} disabled={loading.eval} style={{ ...buttonStyles.success, opacity: loading.eval ? 0.6 : 1 }}>
            {loading.eval ? '...' : '直接求值'}
          </button>
          <button onClick={callTypeCheck} disabled={loading.type} style={{ ...buttonStyles.purple, opacity: loading.type ? 0.6 : 1 }}>
            {loading.type ? '...' : '类型推导'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {traceResult && traceResult.inputExpr !== expr && (
          <div style={{ background: '#fef3c7', color: '#92400e', padding: '0.5rem', borderRadius: 6, marginBottom: '0.8rem', fontSize: '0.75rem' }}>
            表达式已修改，结果对应: {traceResult.inputExpr}
          </div>
        )}

        {traceResult && (
          <div style={styles.card}>
            <div style={{ ...styles.cardTitle, color: '#3b82f6' }}>单步归约</div>

            {selectedStepData && selectedStepData.rule && (
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 6,
                padding: '0.6rem 0.75rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>使用规则:</span>
                <span style={{
                  color: '#0284c7',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  animation: 'fadeIn 0.3s ease-out',
                }}>
                  {selectedStepData.rule}
                </span>
              </div>
            )}

            <div style={{ maxHeight: 280, overflow: 'auto' }}>
              {traceResult.steps?.slice(1).map((step) => {
                const isSelected = selectedStep === step.index;
                return (
                  <div
                    key={step.index}
                    onClick={() => setSelectedStep(step.index)}
                    style={{
                      padding: '0.5rem 0.6rem',
                      fontSize: '0.8rem',
                      background: isSelected ? '#dbeafe' : '#f8fafc',
                      borderRadius: 6,
                      cursor: 'pointer',
                      marginBottom: '0.25rem',
                      borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <code style={{ color: '#1f2937', fontFamily: 'monospace' }}>{step.expr}</code>
                    {step.type && (
                      <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                        : {step.type}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', color: '#10b981', fontWeight: 500 }}>
              最终类型: {traceResult.type}
            </div>
          </div>
        )}

        {evalResult && (
          <div style={styles.card}>
            <div style={{ ...styles.cardTitle, color: '#10b981' }}>直接求值</div>
            <div style={{ fontSize: '0.9rem' }}>结果: <strong style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{evalResult.value}</strong></div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>类型: {evalResult.type}</div>
          </div>
        )}

        {typeResult && (
          <div style={{ background: 'white', borderRadius: 8, padding: '0.8rem', marginBottom: '0.8rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#8b5cf6' }}>类型推导</div>
            <span style={{ fontFamily: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Fira Code", monospace', color: '#1f2937', fontSize: '0.9rem', letterSpacing: '0.02em' }}>{typeResult.type.replace(/->/g, ' → ')}</span>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default App;