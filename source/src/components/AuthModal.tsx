import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from './Dialog';
import { useStore } from '../lib/store';
import { closeAuth, toast, uiStore } from '../store/ui';
import { completeLogin } from '../store/actions';
import { useLegalDocs } from '../hooks/data';
import * as api from '../api/endpoints';
import { errorText } from '../api/client';
import './auth.css';

/** +7 (999) 000-00-00 — маска старого приложения. */
function formatPhone(digits: string) {
  const d = digits.slice(0, 10);
  let out = '';
  if (d.length > 0) out += '(' + d.slice(0, 3);
  if (d.length >= 3) out += ') ';
  if (d.length > 3) out += d.slice(3, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  if (d.length > 8) out += '-' + d.slice(8, 10);
  return out;
}

function normalizeDigits(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
  return d.slice(0, 10);
}

export function AuthModal() {
  const st = useStore(uiStore, (s) => s.auth);
  const nav = useNavigate();
  const docs = useLegalDocs();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [digits, setDigits] = useState('');
  const [consent, setConsent] = useState(false);
  const [promo, setPromo] = useState(false);
  const [verification, setVerification] = useState<{ id: string; len: number; resendAt: number } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!st.open) {
      setStep('phone');
      setCode('');
      setErr(null);
      setBusy(false);
    }
  }, [st.open]);

  useEffect(() => {
    if (step !== 'code') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    codeRef.current?.focus();
    return () => window.clearInterval(t);
  }, [step]);

  const doc = (k: string) => docs.data?.find((d) => d.key === k)?.url ?? '/legal';
  const phone = '+7' + digits;

  const request = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.requestSmsCode(phone);
      setVerification({ id: r.verificationId, len: r.codeLength || 4, resendAt: Date.now() + (r.secondsToResend || 60) * 1000 });
      setCode('');
      setStep('code');
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const login = async (value: string) => {
    if (!verification) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.loginWithSms({ verificationId: verification.id, code: value, acceptPromotionalMailings: promo });
      await completeLogin(r);
      const next = st.next;
      closeAuth();
      toast('Вы вошли в профиль', 'ok');
      if (next) nav(next);
    } catch (e) {
      setErr(errorText(e) || 'Неверный смс код');
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const left = verification ? Math.max(0, Math.ceil((verification.resendAt - now) / 1000)) : 0;

  // «Безопасное» демо (VITE_DEMO_SAFE=1): никаких полей для телефона и кода — только пояснение
  if (import.meta.env.VITE_DEMO_SAFE === '1')
    return (
      <Dialog open={st.open} onClose={closeAuth} title="Вход">
        <div className="auth">
          <p className="demo-note">В демо-версии вход и оформление заказа отключены.</p>
          <p className="muted">На настоящем сайте здесь вход по номеру телефона с SMS-кодом, а затем оформление заказа: время доставки, получатель и способ оплаты.</p>
          <button type="button" className="btn btn--lg btn--block" onClick={closeAuth}>Понятно</button>
        </div>
      </Dialog>
    );

  return (
    <Dialog open={st.open} onClose={closeAuth} title={step === 'phone' ? 'Введите номер телефона' : 'Введите код'}>
      {step === 'phone' ? (
        <form
          className="auth"
          onSubmit={(e) => {
            e.preventDefault();
            if (digits.length === 10 && consent && !busy) request();
          }}
        >
          <p className="muted">На Ваш номер мы отправим код авторизации</p>
          <label className="auth__phone">
            <span className="sr-only">Номер телефона</span>
            <span className="auth__prefix" aria-hidden="true">+7</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(999) 000-00-00"
              value={formatPhone(digits)}
              onChange={(e) => setDigits(normalizeDigits(e.target.value))}
              autoFocus
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>
              Я даю <a className="link" href={doc('personal-data-policy')} target="_blank" rel="noopener">согласие на обработку персональных данных</a> на основании{' '}
              <a className="link" href={doc('privacy-policy')} target="_blank" rel="noopener">политики конфиденциальности</a> и соглашаюсь с{' '}
              <a className="link" href={doc('user-agreement')} target="_blank" rel="noopener">пользовательским соглашением</a>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={promo} onChange={(e) => setPromo(e.target.checked)} />
            <span>
              Я даю <a className="link" href={doc('marketing-communications')} target="_blank" rel="noopener">согласие на получение рекламной рассылки</a>
            </span>
          </label>
          {err && <p className="field__error" role="alert">{err}</p>}
          <button type="submit" className="btn btn--lg btn--block" disabled={digits.length !== 10 || !consent || busy}>
            {busy ? <span className="spinner" /> : 'Войти'}
          </button>
        </form>
      ) : (
        <form
          className="auth"
          onSubmit={(e) => {
            e.preventDefault();
            if (verification && code.length === verification.len) login(code);
          }}
        >
          <p className="muted">
            Мы отправили {verification?.len}-х значный код на телефон <b className="auth__num">+7 {formatPhone(digits)}</b>{' '}
            <button type="button" className="link" onClick={() => setStep('phone')}>Изменить</button>
          </p>
          {import.meta.env.VITE_DEMO === '1' && <p className="demo-note">Демо-версия: SMS не отправляется, подойдёт любой код из {verification?.len ?? 4} цифр.</p>}
          <label className="auth__code">
            <span className="sr-only">Код из SMS</span>
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={verification?.len ?? 6}
              value={code}
              aria-invalid={!!err}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, verification?.len ?? 6);
                setCode(v);
                if (verification && v.length === verification.len && !busy) login(v);
              }}
              style={{ ['--len' as string]: verification?.len ?? 4 }}
            />
          </label>
          {err && <p className="field__error" role="alert">{err}</p>}
          <div className="auth__resend">
            {left > 0 ? (
              <span className="muted">Повторно отправить через {left} с</span>
            ) : (
              <>
                <span className="muted">Не пришел код?</span>
                <button type="button" className="link" onClick={request} disabled={busy}>Отправить еще раз</button>
              </>
            )}
          </div>
          <button type="submit" className="btn btn--lg btn--block" disabled={busy || code.length !== (verification?.len ?? 0)}>
            {busy ? <span className="spinner" /> : 'Продолжить'}
          </button>
        </form>
      )}
    </Dialog>
  );
}
