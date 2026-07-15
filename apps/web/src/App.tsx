import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Card,
  Container,
  Divider,
  FileInput,
  Group,
  Image,
  NavLink,
  Paper,
  PasswordInput,
  Pill,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BookOpen,
  Brain,
  FileText,
  Image as ImageIcon,
  Languages,
  Loader2,
  LogOut,
  History,
  Mic,
  PlayCircle,
  PlusCircle,
  Radio,
  RefreshCw,
  Send,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Square,
  Upload,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api } from './api';
import {
  Copy,
  Locale,
  LOCALE_STORAGE_KEY,
  QUICK_PROMPTS,
  TEXT,
  getInitialLocale,
} from './i18n';
import {
  KnowledgeStatus,
  BackgroundRecoveryResult,
  LessonType,
  StudentMeetingReadiness,
  StudentProfile,
  StudentProfileStatus,
  TutorAnswer,
  TutorImageBlock,
  TutorImageResult,
  TutorLessonHistory,
  TutorLessonHistoryItem,
  TutorLessonLifecycle,
  TutorResponseBlock,
  TutorTurn,
  UserUsageSummary,
  UsageTotals,
  User,
  WebRtcBootstrapPayload,
  WebRtcCloseResponse,
  WebRtcOfferResponse,
} from './types';

type View = 'tutor' | 'knowledge' | 'settings';
type AuthMode = 'login' | 'register';
const VOICE_OUTPUT_STORAGE_KEY = 'egmathteacher.voiceOutputEnabled';
const MAX_SPEECH_TEXT_LENGTH = 1800;
const VOICE_AUTO_RESTART_DELAY_MS = 450;
const VOICE_MAX_AUTO_RESTARTS = 1;
const USAGE_POLL_INTERVAL_MS = 5000;
const REALTIME_ICE_GATHERING_TIMEOUT_MS = 1800;

type VoiceStatus = {
  tone: 'listening' | 'info' | 'warning';
  text: string;
};

type RealtimeVoiceState = {
  status: 'idle' | 'starting' | 'connected' | 'stopping' | 'error';
  sessionId?: string;
  model?: string;
  text?: string;
};

type RealtimeVoiceRuntime = {
  sessionId?: string;
  peerConnection?: RTCPeerConnection;
  localStream?: MediaStream;
  remoteAudio?: HTMLAudioElement;
};

type LessonLauncherItem = {
  id: 'meeting' | 'diagnostic' | 'practice' | 'explain' | 'mistake';
  lessonType: LessonType;
  title: string;
  body: string;
  action: string;
  prompt: string;
  startImmediately: boolean;
};

function App() {
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale());
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<StudentProfileStatus | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [view, setView] = useState<View>('tutor');
  const [mobileOpened, { close: closeMobile, toggle: toggleMobile }] = useDisclosure(false);
  const t = TEXT[locale];

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  useEffect(() => {
    void api<{ user: User | null }>('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileStatus(null);
      setCheckingProfile(false);
      setProfileError(null);
      return;
    }
    setCheckingProfile(true);
    setProfileError(null);
    void api<StudentProfileStatus>('/student-profile/me')
      .then((result) => setProfileStatus(result))
      .catch((err) => {
        setProfileError(err instanceof Error ? err.message : t.errors.profileLoad);
        setProfileStatus({ onboardingRequired: user.role === 'student', profile: null });
      })
      .finally(() => setCheckingProfile(false));
  }, [user, t.errors.profileLoad]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setProfileStatus(null);
    setView('tutor');
    closeMobile();
  }

  function openView(nextView: View) {
    setView(nextView);
    closeMobile();
  }

  if (checkingAuth || (user && checkingProfile)) {
    return (
      <div className="center-screen" role="status" aria-live="polite">
        <Loader2 className="spin" size={26} />
        <Text className="sr-only">{t.loading}</Text>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen locale={locale} t={t} onLocaleChange={setLocale} onUser={setUser} />;
  }

  if (profileStatus?.onboardingRequired) {
    return (
      <FirstMeetingScreen
        user={user}
        locale={locale}
        t={t}
        error={profileError}
        onLocaleChange={setLocale}
        onComplete={setProfileStatus}
        onLogout={logout}
      />
    );
  }

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
      className="app-shell"
    >
      <AppShell.Header className="app-header">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" className="brand-lockup">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label={mobileOpened ? t.nav.closeMenu : t.nav.openMenu}
            />
            <ThemeIcon radius="md" size="lg" color="teal">
              <BookOpen size={20} />
            </ThemeIcon>
            <Box>
              <Text fw={900} lh={1}>
                {t.appTitle}
              </Text>
              <Text size="xs" c="dimmed" visibleFrom="xs">
                {t.appSubtitle}
              </Text>
            </Box>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Badge visibleFrom="sm" color={user.role === 'admin' ? 'indigo' : 'teal'} variant="light">
              {user.role === 'admin' ? t.common.admin : t.common.student}
            </Badge>
            <LanguageSwitch locale={locale} t={t} onChange={setLocale} />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" className="sidebar">
        <Stack h="100%" gap="lg">
          <Group gap="sm">
            <ThemeIcon radius="md" size="lg" color="teal">
              <Sparkles size={20} />
            </ThemeIcon>
            <Box>
              <Title order={3}>{t.appTitle}</Title>
              <Text size="xs" c="dimmed">
                {t.nav.userArea}
              </Text>
            </Box>
          </Group>

          <Paper withBorder radius="md" p="sm" className="user-panel">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="indigo">
                <UserIcon size={16} />
              </ThemeIcon>
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Text fw={800} truncate>
                  {user.name}
                </Text>
                <Badge color={user.role === 'admin' ? 'indigo' : 'teal'} variant="light">
                  {user.role === 'admin' ? t.common.admin : t.common.student}
                </Badge>
              </Box>
            </Group>
          </Paper>

          <Stack gap={6}>
            <NavLink
              active={view === 'tutor'}
              label={t.nav.tutor}
              leftSection={<BookOpen size={18} />}
              onClick={() => openView('tutor')}
              variant="light"
              color="teal"
              styles={{ root: { borderRadius: 8 } }}
            />
            <NavLink
              active={view === 'settings'}
              label={t.nav.settings}
              leftSection={<SettingsIcon size={18} />}
              onClick={() => openView('settings')}
              variant="light"
              color="teal"
              styles={{ root: { borderRadius: 8 } }}
            />
            {user.role === 'admin' && (
              <NavLink
                active={view === 'knowledge'}
                label={t.nav.knowledge}
                leftSection={<Shield size={18} />}
                onClick={() => openView('knowledge')}
                variant="light"
                color="teal"
                styles={{ root: { borderRadius: 8 } }}
              />
            )}
          </Stack>

          <Button mt="auto" variant="default" leftSection={<LogOut size={18} />} onClick={logout}>
            {t.common.logout}
          </Button>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {view === 'tutor' ? (
          <TutorWorkspace locale={locale} t={t} profile={profileStatus?.profile ?? null} />
        ) : view === 'settings' ? (
          <SettingsView
            user={user}
            locale={locale}
            t={t}
            profile={profileStatus?.profile ?? null}
            onLocaleChange={setLocale}
          />
        ) : (
          <KnowledgeAdmin t={t} />
        )}
      </AppShell.Main>
    </AppShell>
  );
}

function LanguageSwitch({
  locale,
  t,
  onChange,
}: {
  locale: Locale;
  t: Copy;
  onChange: (locale: Locale) => void;
}) {
  return (
    <Group gap={6} wrap="nowrap" className="language-switch">
      <Languages size={16} aria-hidden="true" />
      <SegmentedControl
        aria-label={t.language.switchLabel}
        size="xs"
        value={locale}
        onChange={(value) => onChange(value as Locale)}
        data={[
          { value: 'ru', label: t.language.ru },
          { value: 'en', label: t.language.en },
        ]}
      />
    </Group>
  );
}

function AuthScreen({
  locale,
  t,
  onLocaleChange,
  onUser,
}: {
  locale: Locale;
  t: Copy;
  onLocaleChange: (locale: Locale) => void;
  onUser: (user: User) => void;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ user: User }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ name, password }),
      });
      onUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.auth);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <Card className="auth-card" withBorder shadow="xl" padding="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon radius="md" size="xl" color="teal">
                <BookOpen size={24} />
              </ThemeIcon>
              <Box>
                <Title order={2}>{t.appTitle}</Title>
                <Text c="dimmed" size="sm">
                  {t.appSubtitle}
                </Text>
              </Box>
            </Group>
            <LanguageSwitch locale={locale} t={t} onChange={onLocaleChange} />
          </Group>

          <SegmentedControl
            fullWidth
            value={mode}
            onChange={(value) => setMode(value as AuthMode)}
            data={[
              { value: 'login', label: t.auth.login },
              { value: 'register', label: t.auth.register },
            ]}
          />

          <form onSubmit={submit}>
            <Stack>
              <TextInput
                label={t.auth.name}
                placeholder={t.auth.namePlaceholder}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                autoComplete="username"
                size="md"
              />
              <PasswordInput
                label={t.auth.password}
                placeholder={t.auth.passwordPlaceholder}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                size="md"
              />
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                size="md"
                loading={busy}
                leftSection={<UserIcon size={18} />}
                color="teal"
              >
                {mode === 'login' ? t.auth.submitLogin : t.auth.submitRegister}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>

      <div className="auth-intro">
        <div className="math-visual" aria-hidden="true">
          <div className="axis x" />
          <div className="axis y" />
          <div className="curve" />
          <div className="point p1" />
          <div className="point p2" />
          <div className="formula">x² + y² = r²</div>
        </div>
        <Paper withBorder radius="md" p="md" className="auth-proof">
          <Text fw={900}>{t.auth.promise}</Text>
          <Stack gap={6} mt="sm">
            {[t.auth.proof1, t.auth.proof2, t.auth.proof3].map((item) => (
              <Group key={item} gap="xs" wrap="nowrap">
                <ThemeIcon size="sm" radius="xl" color="teal" variant="light">
                  <Sparkles size={13} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  {item}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      </div>
    </div>
  );
}

function FirstMeetingScreen({
  user,
  locale,
  t,
  error,
  onLocaleChange,
  onComplete,
  onLogout,
}: {
  user: User;
  locale: Locale;
  t: Copy;
  error: string | null;
  onLocaleChange: (locale: Locale) => void;
  onComplete: (status: StudentProfileStatus) => void;
  onLogout: () => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [profileConversationId, setProfileConversationId] = useState<string | undefined>();
  const [activeLessonSessionId, setActiveLessonSessionId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(
    () => window.localStorage.getItem(VOICE_OUTPUT_STORAGE_KEY) !== 'false',
  );
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [meetingReadiness, setMeetingReadiness] = useState<StudentMeetingReadiness | null>(null);
  const [meetingHydrated, setMeetingHydrated] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationIdRef = useRef<string | undefined>(conversationId);
  const voiceOutputEnabledRef = useRef(voiceOutputEnabled);
  const autoListenAfterSpeechRef = useRef(false);
  const manualVoiceStopRef = useRef(false);
  const autoVoiceRestartCountRef = useRef(0);
  const meetingReadinessRequestRef = useRef(0);

  const speechSupported = useMemo(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );
  const speechOutputSupported = useMemo(
    () => Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance),
    [],
  );
  const answeredTurnCount = turns.filter((turn) => turn.answer).length;
  const meetingTerminal = turns.some((turn) => turn.answer && isTerminalTutorAnswer(turn.answer));
  const finalizableConversationId =
    profileConversationId ?? conversationId ?? meetingReadiness?.conversationId;
  const canBuildProfile = Boolean(
    meetingReadiness?.canCreateProfile && finalizableConversationId && !sending && !finalizing,
  );

  useEffect(
    () => () => {
      autoListenAfterSpeechRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    void hydrateActiveMeeting();
    void refreshMeetingReadiness();
  }, []);

  useEffect(() => {
    void refreshMeetingReadiness(finalizableConversationId);
  }, [answeredTurnCount, finalizableConversationId]);

  useEffect(() => {
    voiceOutputEnabledRef.current = voiceOutputEnabled;
  }, [voiceOutputEnabled]);

  useEffect(() => {
    if (!speechOutputSupported) {
      return undefined;
    }
    const loadVoices = () => setSpeechVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [speechOutputSupported]);

  async function hydrateActiveMeeting() {
    try {
      const activeHistory = await api<TutorLessonHistory>(
        '/tutor/lessons?scope=active&limit=4&turnLimit=8',
      );
      let meeting = activeHistory.lessons.find(
        (lesson) =>
          lesson.lessonType === 'meeting' &&
          !isTerminalLessonStatus(lesson.status) &&
          lesson.turns.length > 0,
      );
      if (!meeting) {
        const historicalHistory = await api<TutorLessonHistory>(
          '/tutor/lessons?scope=history&limit=4&turnLimit=8',
        );
        meeting = historicalHistory.lessons.find(
          (lesson) => lesson.lessonType === 'meeting' && isTerminalLessonStatus(lesson.status),
        );
      }
      if (!meeting || meeting.turns.length === 0) {
        setMeetingHydrated(true);
        return;
      }
      const terminalMeeting = isTerminalLessonStatus(meeting.status);
      conversationIdRef.current = terminalMeeting ? undefined : meeting.conversationId;
      setConversationId(terminalMeeting ? undefined : meeting.conversationId);
      setProfileConversationId(meeting.conversationId);
      setActiveLessonSessionId(terminalMeeting ? undefined : meeting.lessonSessionId);
      setTurns(meeting.turns);
      void refreshMeetingReadiness(meeting.conversationId);
    } catch {
      // First-meeting recovery is helpful but must not block a fresh meeting.
    } finally {
      setMeetingHydrated(true);
    }
  }

  async function refreshMeetingReadiness(nextConversationId = conversationIdRef.current) {
    const requestIndex = meetingReadinessRequestRef.current + 1;
    meetingReadinessRequestRef.current = requestIndex;
    const query = nextConversationId
      ? `?conversationId=${encodeURIComponent(nextConversationId)}`
      : '';
    try {
      const readiness = await api<StudentMeetingReadiness>(
        `/student-profile/me/meeting-readiness${query}`,
      );
      if (meetingReadinessRequestRef.current === requestIndex) {
        setMeetingReadiness(readiness);
      }
    } catch {
      if (meetingReadinessRequestRef.current === requestIndex) {
        setMeetingReadiness(null);
      }
    }
  }

  function startMeeting() {
    if (sending) {
      return;
    }
    stopMeetingSpeech();
    stopVoice();
    setTurns([]);
    setMeetingReadiness(null);
    setProfileConversationId(undefined);
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    setActiveLessonSessionId(undefined);
    void sendMeetingMessage(
      t.onboarding.voiceStartPrompt,
      'text',
      true,
      t.onboarding.startedTranscript,
    );
  }

  async function sendMeetingMessage(
    rawPrompt = draft,
    source: 'text' | 'voice' = 'text',
    forceNewConversation = false,
    displayPrompt?: string,
  ) {
    const prompt = rawPrompt.trim();
    if (!prompt || sending) {
      return;
    }
    if (meetingTerminal && !forceNewConversation) {
      setSubmitError(t.onboarding.meetingFinished);
      return;
    }
    setSending(true);
    setSubmitError(null);
    setDraft('');
    setVoiceInterim('');
    setVoiceStatus(null);
    const id = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const currentConversationId = forceNewConversation ? undefined : conversationIdRef.current;
    setTurns((current) => [
      {
        id,
        prompt: displayPrompt ?? prompt,
        source,
        lessonType: 'meeting',
      },
      ...current,
    ]);
    try {
      const answer = await api<TutorAnswer>('/tutor/message', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          conversationId: currentConversationId,
          requestId,
          source,
          lessonType: 'meeting',
        }),
      });
      const terminalAnswer = isTerminalTutorAnswer(answer);
      setProfileConversationId(answer.conversationId);
      if (terminalAnswer) {
        conversationIdRef.current = undefined;
        setConversationId(undefined);
        setActiveLessonSessionId(undefined);
        stopVoice();
      } else {
        conversationIdRef.current = answer.conversationId;
        setConversationId(answer.conversationId);
        setActiveLessonSessionId(answer.lessonLifecycle?.lessonSessionId);
      }
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, answer } : turn)),
      );
      void refreshMeetingReadiness(answer.conversationId);
      if (voiceOutputEnabled) {
        speakMeetingAnswer(id, answer, canContinueVoiceDialog(answer));
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t.errors.tutor);
      setTurns((current) => current.filter((turn) => turn.id !== id));
    } finally {
      setSending(false);
    }
  }

  async function finalizeFromConversation() {
    const conversationForProfile = finalizableConversationId;
    if (!conversationForProfile || finalizing) {
      return;
    }
    setFinalizing(true);
    setSubmitError(null);
    stopMeetingSpeech();
    stopVoice();
    try {
      const result = await api<StudentProfileStatus>('/student-profile/me/from-conversation', {
        method: 'POST',
        body: JSON.stringify({ conversationId: conversationForProfile }),
      });
      onComplete(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t.errors.onboardingSave);
    } finally {
      setFinalizing(false);
    }
  }

  function startVoice(auto = false) {
    if (meetingTerminal) {
      if (!auto) {
        setSubmitError(t.onboarding.meetingFinished);
      }
      return;
    }
    if (listening || recognitionRef.current) {
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      if (!auto) {
        setSubmitError(t.errors.speechUnsupported);
      }
      setVoiceStatus({ tone: 'warning', text: t.tutor.voiceStatus.unsupported });
      return;
    }
    manualVoiceStopRef.current = false;
    const recognition = new Recognition();
    recognition.lang = locale === 'ru' ? 'ru-RU' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    let finalText = '';
    let latestTranscript = '';
    let latestError: string | undefined;
    let completed = false;
    const finishRecognition = () => {
      if (completed) {
        return;
      }
      completed = true;
      setListening(false);
      setVoiceInterim('');
      recognitionRef.current = null;
      const spoken = getBestRecognizedSpeechText(finalText, latestTranscript);
      if (spoken) {
        autoVoiceRestartCountRef.current = 0;
        setVoiceStatus(null);
        void sendMeetingMessage(spoken, 'voice');
        return;
      }
      if (manualVoiceStopRef.current) {
        manualVoiceStopRef.current = false;
        autoVoiceRestartCountRef.current = 0;
        setVoiceStatus(null);
        return;
      }
      const canRetry =
        auto &&
        voiceOutputEnabledRef.current &&
        speechSupported &&
        shouldRetryVoiceInput(latestError) &&
        autoVoiceRestartCountRef.current < VOICE_MAX_AUTO_RESTARTS;
      if (canRetry) {
        autoVoiceRestartCountRef.current += 1;
        setVoiceStatus({ tone: 'warning', text: t.tutor.voiceStatus.retrying });
        window.setTimeout(() => startVoice(true), VOICE_AUTO_RESTART_DELAY_MS);
        return;
      }
      autoVoiceRestartCountRef.current = 0;
      setVoiceStatus({ tone: 'warning', text: getVoiceStopMessage(latestError, t) });
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += ` ${transcript}`;
        } else {
          interim += transcript;
        }
      }
      latestTranscript = normalizeRecognizedSpeech(`${finalText} ${interim}`);
      setVoiceInterim(normalizeRecognizedSpeech(interim));
      setVoiceStatus({ tone: 'listening', text: t.tutor.voiceStatus.heard });
    };
    recognition.onerror = (event) => {
      const errorCode = (event as { error?: unknown }).error;
      latestError = typeof errorCode === 'string' ? errorCode : undefined;
      if (!auto && !isExpectedSpeechSilence(latestError)) {
        setSubmitError(t.errors.speechFailed);
      }
      finishRecognition();
    };
    recognition.onend = () => {
      finishRecognition();
    };
    recognitionRef.current = recognition;
    setListening(true);
    setVoiceStatus({
      tone: 'listening',
      text: auto ? t.tutor.voiceStatus.autoListening : t.tutor.voiceStatus.listening,
    });
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      if (!auto) {
        setSubmitError(t.errors.speechFailed);
      }
      setVoiceStatus({
        tone: 'warning',
        text: auto ? t.tutor.voiceStatus.restartBlocked : t.tutor.voiceStatus.browserStopped,
      });
    }
  }

  function stopVoice() {
    manualVoiceStopRef.current = true;
    autoVoiceRestartCountRef.current = 0;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setVoiceStatus(null);
  }

  function toggleVoiceOutput(checked: boolean) {
    setVoiceOutputEnabled(checked);
    window.localStorage.setItem(VOICE_OUTPUT_STORAGE_KEY, checked ? 'true' : 'false');
    if (!checked) {
      stopMeetingSpeech();
    }
  }

  function speakMeetingAnswer(turnId: string, answer: TutorAnswer, continueDialog = false) {
    if (!speechOutputSupported) {
      setSubmitError(t.errors.speechOutputUnsupported);
      return;
    }
    const speechText = getTutorSpeechText(answer, t.tutor.imageAlt, locale);
    if (!speechText) {
      return;
    }
    autoListenAfterSpeechRef.current = false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = locale === 'ru' ? 'ru-RU' : 'en-US';
    utterance.voice = selectSpeechVoice(speechVoices, locale);
    utterance.rate = locale === 'ru' ? 0.9 : 0.96;
    utterance.pitch = locale === 'ru' ? 1.04 : 1;
    autoListenAfterSpeechRef.current = continueDialog && canContinueVoiceDialog(answer);
    utterance.onend = () => {
      setSpeakingTurnId((current) => (current === turnId ? null : current));
      if (
        autoListenAfterSpeechRef.current &&
        voiceOutputEnabledRef.current &&
        speechSupported &&
        canContinueVoiceDialog(answer)
      ) {
        autoListenAfterSpeechRef.current = false;
        window.setTimeout(() => startVoice(true), 250);
      }
    };
    utterance.onerror = () => {
      autoListenAfterSpeechRef.current = false;
      setSpeakingTurnId((current) => (current === turnId ? null : current));
      setSubmitError(t.errors.speechOutputFailed);
    };
    setSpeakingTurnId(turnId);
    window.speechSynthesis.speak(utterance);
  }

  function stopMeetingSpeech() {
    autoListenAfterSpeechRef.current = false;
    window.speechSynthesis?.cancel();
    setSpeakingTurnId(null);
  }

  return (
    <div className="onboarding-layout">
      <Card className="onboarding-card" withBorder shadow="xl" padding="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <Box>
              <Badge color="teal" variant="light" mb="xs">
                {t.onboarding.badge}
              </Badge>
              <Title order={1}>{t.onboarding.title}</Title>
              <Text c="dimmed">{t.onboarding.subtitle}</Text>
            </Box>
            <Group gap="xs">
              <LanguageSwitch locale={locale} t={t} onChange={onLocaleChange} />
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  void onLogout();
                }}
              >
                {t.common.logout}
              </Button>
            </Group>
          </Group>

          <Paper withBorder radius="md" p="md" className="meeting-status">
            <Group justify="space-between" gap="md" align="center">
              <Group gap="xs">
                <ThemeIcon variant="light" color="teal">
                  <Brain size={16} />
                </ThemeIcon>
                <Box>
                  <Text fw={900}>{user.name}</Text>
                  <Text size="sm" c="dimmed">
                    {t.onboarding.meetingStatus}
                  </Text>
                </Box>
              </Group>
              <Badge color={meetingTerminal ? 'blue' : canBuildProfile ? 'green' : 'gray'} variant="light">
                {meetingTerminal
                  ? t.onboarding.finishedBadge
                  : canBuildProfile
                    ? t.onboarding.readyBadge
                    : t.onboarding.inProgressBadge}
              </Badge>
            </Group>
          </Paper>

          {error && (
            <Alert color="yellow" variant="light">
              {error}
            </Alert>
          )}

          <Paper withBorder radius="md" p="lg" className="onboarding-voice-panel">
            <Stack gap="md">
              <Group justify="space-between" align="center" gap="md">
                <Group gap="sm" align="center">
                  <ThemeIcon size="xl" radius="md" color="green" variant="light">
                    <Mic size={24} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={900}>{t.onboarding.voiceTitle}</Text>
                    <Text size="sm" c="dimmed">
                      {t.onboarding.voiceBody}
                    </Text>
                  </Box>
                </Group>
                <Button
                  size="lg"
                  color="green"
                  className="lesson-start-button"
                  leftSection={<PlayCircle size={20} />}
                  loading={!meetingHydrated || (sending && turns.length === 0)}
                  onClick={startMeeting}
                  disabled={!meetingHydrated}
                >
                  {turns.length === 0
                    ? t.onboarding.voiceStart
                    : meetingTerminal
                      ? t.onboarding.startNewMeeting
                      : t.onboarding.restartMeeting}
                </Button>
              </Group>

              <Group justify="space-between" gap="sm" align="center" className="voice-dialog-row">
                <Tooltip
                  label={
                    speechOutputSupported
                      ? t.tutor.voiceOutputHelp
                      : t.tutor.voiceOutputUnavailable
                  }
                >
                  <Switch
                    label={t.tutor.voiceOutput}
                    checked={voiceOutputEnabled && speechOutputSupported}
                    onChange={(event) => toggleVoiceOutput(event.currentTarget.checked)}
                    disabled={!speechOutputSupported}
                    size="md"
                  />
                </Tooltip>
                <Group justify="flex-end" gap="sm">
                  <Tooltip label={speechSupported ? t.tutor.voiceTitle : t.tutor.voiceUnavailable}>
                    <ActionIcon
                      size="xl"
                      variant={listening ? 'filled' : 'light'}
                      color={listening ? 'red' : 'teal'}
                      onClick={listening ? stopVoice : () => startVoice()}
                      disabled={!speechSupported || sending || turns.length === 0 || meetingTerminal}
                      title={speechSupported ? t.tutor.voiceTitle : t.tutor.voiceUnavailable}
                    >
                      {listening ? <Square size={18} /> : <Mic size={18} />}
                    </ActionIcon>
                  </Tooltip>
                  <Button
                    color="teal"
                    loading={finalizing}
                    disabled={!canBuildProfile}
                    leftSection={<Sparkles size={18} />}
                    onClick={() => void finalizeFromConversation()}
                  >
                    {t.onboarding.completeFromConversation}
                  </Button>
                </Group>
              </Group>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMeetingMessage();
                }}
              >
                <Group align="flex-end" gap="sm">
                  <Textarea
                    ref={textareaRef}
                    className="onboarding-text-fallback"
                    value={listening ? voiceInterim || draft : draft}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    placeholder={t.onboarding.textFallbackPlaceholder}
                    autosize
                    minRows={2}
                    maxRows={5}
                    disabled={listening || turns.length === 0 || meetingTerminal}
                  />
                  <Button
                    type="submit"
                    color="teal"
                    loading={sending && turns.length > 0}
                    disabled={!draft.trim() || turns.length === 0 || meetingTerminal}
                    leftSection={<Send size={18} />}
                  >
                    {t.onboarding.sendFallback}
                  </Button>
                </Group>
              </form>

              {voiceStatus && (
                <Group
                  gap="xs"
                  className={`voice-status voice-status-${voiceStatus.tone}`}
                  role="status"
                  aria-live="polite"
                >
                  <Mic size={14} />
                  <Text size="sm" fw={700}>
                    {voiceStatus.text}
                  </Text>
                </Group>
              )}

              <Alert color={meetingTerminal || canBuildProfile ? 'green' : 'teal'} variant="light">
                {meetingTerminal
                  ? canBuildProfile
                    ? t.onboarding.meetingFinishedReady
                    : t.onboarding.meetingFinishedStartOver
                  : canBuildProfile
                    ? t.onboarding.conversationReady
                    : t.onboarding.needMoreConversation}
              </Alert>
            </Stack>
          </Paper>

          {submitError && (
            <Alert color="red" variant="light">
              {submitError}
            </Alert>
          )}

          <Stack gap="sm" className="onboarding-transcript">
            <Group justify="space-between" gap="sm">
              <Text fw={900}>{t.onboarding.transcriptTitle}</Text>
              {activeLessonSessionId && (
                <Badge color="gray" variant="light">
                  {t.tutor.lessonModes.meeting}
                </Badge>
              )}
            </Group>
            {turns.length === 0 ? (
              <Paper withBorder radius="md" p="md" className="lesson-history-empty">
                <Text fw={900}>{t.onboarding.emptyTranscriptTitle}</Text>
                <Text size="sm" c="dimmed">
                  {t.onboarding.emptyTranscriptBody}
                </Text>
              </Paper>
            ) : (
              turns.map((turn) => (
                <Paper key={turn.id} withBorder radius="md" p="md" className="onboarding-turn">
                  <Stack gap="xs">
                    <Group gap="xs">
                      <Badge color={turn.source === 'voice' ? 'teal' : 'gray'} variant="light">
                        {turn.source === 'voice' ? t.common.voice : t.common.text}
                      </Badge>
                      {speakingTurnId === turn.id && (
                        <Badge color="green" variant="light">
                          {t.tutor.stopSpeaking}
                        </Badge>
                      )}
                    </Group>
                    <Box className="onboarding-student-bubble">
                      <Text size="xs" c="dimmed" fw={800}>
                        {t.onboarding.studentLabel}
                      </Text>
                      <Text className="break-anywhere">{turn.prompt}</Text>
                    </Box>
                    {turn.answer ? (
                      <Box className="onboarding-assistant-bubble">
                        <Group justify="space-between" gap="sm">
                          <Text size="xs" c="dimmed" fw={800}>
                            {t.onboarding.assistantLabel}
                          </Text>
                          {speechOutputSupported && (
                            <ActionIcon
                              variant="subtle"
                              color={speakingTurnId === turn.id ? 'red' : 'teal'}
                              onClick={() =>
                                speakingTurnId === turn.id
                                  ? stopMeetingSpeech()
                                  : speakMeetingAnswer(turn.id, turn.answer!, voiceOutputEnabled)
                              }
                              title={
                                speakingTurnId === turn.id
                                  ? t.tutor.stopSpeaking
                                  : t.tutor.speakAnswer
                              }
                            >
                              {speakingTurnId === turn.id ? (
                                <VolumeX size={16} />
                              ) : (
                                <Volume2 size={16} />
                              )}
                            </ActionIcon>
                          )}
                        </Group>
                        <Text className="prewrap">
                          {getTutorSpeechText(turn.answer, t.tutor.imageAlt, locale)}
                        </Text>
                      </Box>
                    ) : (
                      <Group gap="xs" c="dimmed">
                        <Loader2 size={16} className="spin" />
                        <Text size="sm">{t.tutor.thinking}</Text>
                      </Group>
                    )}
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        </Stack>
      </Card>
    </div>
  );
}

function TutorWorkspace({
  locale,
  t,
  profile,
}: {
  locale: Locale;
  t: Copy;
  profile: StudentProfile | null;
}) {
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [lessonType, setLessonType] = useState<LessonType>('tutor');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [usageSummary, setUsageSummary] = useState<UserUsageSummary | null>(null);
  const [usageExpanded, setUsageExpanded] = useState(false);
  const [usageRefreshing, setUsageRefreshing] = useState(false);
  const [backgroundRecovering, setBackgroundRecovering] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(
    () => window.localStorage.getItem(VOICE_OUTPUT_STORAGE_KEY) !== 'false',
  );
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [realtimeVoice, setRealtimeVoice] = useState<RealtimeVoiceState>({
    status: 'idle',
    text: t.tutor.realtimeVoice.idle,
  });
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lessonHistory, setLessonHistory] = useState<TutorLessonHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeLessonSessionId, setActiveLessonSessionId] = useState<string | undefined>();
  const [historyRecordLessonId, setHistoryRecordLessonId] = useState<string | undefined>();
  const [finishingLesson, setFinishingLesson] = useState(false);
  const [continuityNotice, setContinuityNotice] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lessonFocusRef = useRef<HTMLDivElement | null>(null);
  const conversationIdRef = useRef<string | undefined>(conversationId);
  const voiceOutputEnabledRef = useRef(voiceOutputEnabled);
  const autoListenAfterSpeechRef = useRef(false);
  const manualVoiceStopRef = useRef(false);
  const autoVoiceRestartCountRef = useRef(0);
  const realtimeVoiceRef = useRef<RealtimeVoiceRuntime>({});
  const autoGeneratedImageKeysRef = useRef(new Set<string>());
  const autoImageTurnIdsRef = useRef(new Set<string>());

  const speechSupported = useMemo(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );
  const speechOutputSupported = useMemo(
    () => Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance),
    [],
  );
  const realtimeVoiceSupported = useMemo(
    () => Boolean(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia),
    [],
  );

  const activeLifecycle = useMemo(
    () =>
      conversationId
        ? turns.find((turn) => turn.answer?.lessonLifecycle?.conversationId === conversationId)
            ?.answer?.lessonLifecycle
        : undefined,
    [conversationId, turns],
  );
  const hasActiveBackgroundJobs = useMemo(
    () =>
      (usageSummary?.backgroundJobs ?? []).some((job) =>
        ['pending', 'running'].includes(job.status),
      ),
    [usageSummary],
  );
  const viewingHistoryRecord = Boolean(historyRecordLessonId);
  const launcherCards = useMemo<LessonLauncherItem[]>(
    () => [
      {
        id: 'meeting',
        lessonType: 'meeting',
        title: t.tutor.launcher.cards.meeting.title,
        body: t.tutor.launcher.cards.meeting.body,
        action: t.tutor.launcher.cards.meeting.action,
        prompt: t.tutor.launcher.cards.meeting.prompt,
        startImmediately: true,
      },
      {
        id: 'diagnostic',
        lessonType: 'diagnostic',
        title: t.tutor.launcher.cards.diagnostic.title,
        body: t.tutor.launcher.cards.diagnostic.body,
        action: t.tutor.launcher.cards.diagnostic.action,
        prompt: t.tutor.launcher.cards.diagnostic.prompt,
        startImmediately: true,
      },
      {
        id: 'practice',
        lessonType: 'practice',
        title: t.tutor.launcher.cards.practice.title,
        body: t.tutor.launcher.cards.practice.body,
        action: t.tutor.launcher.cards.practice.action,
        prompt: t.tutor.launcher.cards.practice.prompt,
        startImmediately: true,
      },
      {
        id: 'explain',
        lessonType: 'tutor',
        title: t.tutor.launcher.cards.explain.title,
        body: t.tutor.launcher.cards.explain.body,
        action: t.tutor.launcher.cards.explain.action,
        prompt: t.tutor.launcher.cards.explain.prompt,
        startImmediately: false,
      },
      {
        id: 'mistake',
        lessonType: 'mistake_review',
        title: t.tutor.launcher.cards.mistake.title,
        body: t.tutor.launcher.cards.mistake.body,
        action: t.tutor.launcher.cards.mistake.action,
        prompt: t.tutor.launcher.cards.mistake.prompt,
        startImmediately: false,
      },
    ],
    [t],
  );

  useEffect(() => {
    void refreshUsage();
    void refreshLessonHistory(true);
  }, []);

  useEffect(
    () => () => {
      autoListenAfterSpeechRef.current = false;
      void stopRealtimeVoice(false);
      window.speechSynthesis?.cancel();
    },
    [],
  );

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    voiceOutputEnabledRef.current = voiceOutputEnabled;
  }, [voiceOutputEnabled]);

  useEffect(() => {
    if (!usageExpanded && !hasActiveBackgroundJobs) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void refreshUsage(activeLessonSessionId);
    }, USAGE_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activeLessonSessionId, hasActiveBackgroundJobs, usageExpanded]);

  useEffect(() => {
    if (!speechOutputSupported) {
      return undefined;
    }
    const loadVoices = () => setSpeechVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [speechOutputSupported]);

  useEffect(() => {
    if (viewingHistoryRecord) {
      return;
    }
    for (const turn of turns) {
      if (!turn.answer) {
        continue;
      }
      for (const block of getTutorBlocks(turn.answer, t.tutor.imageAlt)) {
        if (
          block.type !== 'image' ||
          !shouldAutoGenerateImage(turn, block, autoImageTurnIdsRef.current)
        ) {
          continue;
        }
        const key = imageGenerationKey(turn, block);
        if (autoGeneratedImageKeysRef.current.has(key)) {
          continue;
        }
        autoGeneratedImageKeysRef.current.add(key);
        void generateImage(turn, block);
      }
    }
  }, [turns, t.tutor.imageAlt, viewingHistoryRecord]);

  async function refreshUsage(lessonSessionId?: string) {
    const query = lessonSessionId ? `?lessonSessionId=${encodeURIComponent(lessonSessionId)}` : '';
    setUsageRefreshing(true);
    try {
      setUsageSummary(await api<UserUsageSummary>(`/usage/me/summary${query}`));
    } catch {
      // Usage visibility must not block tutoring when the POC API is unavailable.
    } finally {
      setUsageRefreshing(false);
    }
  }

  async function recoverBackgroundJobs() {
    if (backgroundRecovering) {
      return;
    }
    setBackgroundRecovering(true);
    setError(null);
    try {
      await api<BackgroundRecoveryResult>('/usage/me/background/recover', {
        method: 'POST',
        body: JSON.stringify({
          limit: 1,
          conversationId,
        }),
      });
      await refreshUsage(activeLessonSessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.tutor);
    } finally {
      setBackgroundRecovering(false);
    }
  }

  async function refreshLessonHistory(hydrateLatest = false) {
    setHistoryLoading(true);
    try {
      const [activeHistory, historicalHistory] = await Promise.all([
        api<TutorLessonHistory>('/tutor/lessons?scope=active&limit=4&turnLimit=6'),
        api<TutorLessonHistory>('/tutor/lessons?scope=history&limit=8&turnLimit=6'),
      ]);
      const lessons = [...activeHistory.lessons, ...historicalHistory.lessons];
      setLessonHistory(lessons);
      const latestActiveLesson = activeHistory.lessons[0];
      if (hydrateLatest && turns.length === 0 && latestActiveLesson?.turns.length > 0) {
        loadLessonFromHistory(latestActiveLesson, { announce: false, focus: false });
      }
    } catch {
      // Lesson continuity is helpful, but it must not block a new tutor turn.
    } finally {
      setHistoryLoaded(true);
      setHistoryLoading(false);
    }
  }

  function loadLessonFromHistory(
    lesson: TutorLessonHistoryItem,
    options: { announce?: boolean; focus?: boolean } = {},
  ) {
    stopTutorSpeech();
    stopVoice();
    void stopRealtimeVoice(false);
    setLessonType(lesson.lessonType);
    setDraft('');
    setVoiceInterim('');
    setTurns(lesson.turns);
    if (isTerminalLessonStatus(lesson.status)) {
      conversationIdRef.current = undefined;
      setConversationId(undefined);
      setActiveLessonSessionId(undefined);
      setHistoryRecordLessonId(lesson.lessonSessionId);
      setUsageSummary((currentSummary) =>
        currentSummary ? { ...currentSummary, currentLesson: null } : currentSummary,
      );
    } else {
      conversationIdRef.current = lesson.conversationId;
      setConversationId(lesson.conversationId);
      setActiveLessonSessionId(lesson.lessonSessionId);
      setHistoryRecordLessonId(undefined);
    }
    if (options.announce !== false) {
      setContinuityNotice(
        isTerminalLessonStatus(lesson.status)
          ? t.tutor.continuity.historyOpenedNotice
          : lesson.turns.length > 0
          ? t.tutor.continuity.openedNotice
          : t.tutor.continuity.openedWithoutTurnsNotice,
      );
    }
    if (options.focus !== false) {
      focusLessonWorkspace();
    }
    void refreshUsage(lesson.lessonSessionId);
  }

  function focusLessonWorkspace() {
    window.setTimeout(() => {
      lessonFocusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      textareaRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  function clearLessonBoundary() {
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    setActiveLessonSessionId(undefined);
    setHistoryRecordLessonId(undefined);
    setUsageSummary((currentSummary) =>
      currentSummary ? { ...currentSummary, currentLesson: null } : currentSummary,
    );
  }

  function startNewLesson() {
    stopTutorSpeech();
    stopVoice();
    void stopRealtimeVoice(false);
    clearLessonBoundary();
    setContinuityNotice(null);
    setTurns([]);
    setDraft('');
    setVoiceInterim('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function changeLessonType(value: string) {
    const nextLessonType = toLessonType(value);
    if (nextLessonType !== lessonType) {
      void stopRealtimeVoice(false);
      clearLessonBoundary();
      setContinuityNotice(null);
    }
    setLessonType(nextLessonType);
  }

  async function sendMessage(
    rawPrompt = draft,
    source: 'text' | 'voice' = 'text',
    overrideLessonType?: LessonType,
    forceNewConversation = false,
  ) {
    const prompt = rawPrompt.trim();
    if (!prompt || sending) {
      return;
    }
    if (viewingHistoryRecord) {
      setContinuityNotice(t.tutor.continuity.historyReadOnlyNotice);
      return;
    }
    setSending(true);
    setError(null);
    setContinuityNotice(null);
    setDraft('');
    setVoiceInterim('');
    setVoiceStatus(null);
    const id = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const currentLessonType = overrideLessonType ?? lessonType;
    const currentConversationId = forceNewConversation ? undefined : conversationIdRef.current;
    setTurns((current) => [{ id, prompt, source, lessonType: currentLessonType }, ...current]);
    try {
      const answer = await api<TutorAnswer>('/tutor/message', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          conversationId: currentConversationId,
          requestId,
          source,
          lessonType: currentLessonType,
        }),
      });
      const terminalAnswer = isTerminalTutorAnswer(answer);
      if (terminalAnswer) {
        conversationIdRef.current = undefined;
        setConversationId(undefined);
        setActiveLessonSessionId(undefined);
        setHistoryRecordLessonId(answer.lessonLifecycle?.lessonSessionId);
      } else {
        conversationIdRef.current = answer.conversationId;
        setConversationId(answer.conversationId);
        setActiveLessonSessionId(answer.lessonLifecycle?.lessonSessionId);
        setHistoryRecordLessonId(undefined);
      }
      autoImageTurnIdsRef.current.add(answer.turnId ?? id);
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, answer } : turn)),
      );
      if (voiceOutputEnabled) {
        speakTutorAnswer(id, answer, canContinueVoiceDialog(answer));
      }
      void refreshUsage(answer.lessonLifecycle?.lessonSessionId);
      void refreshLessonHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.tutor);
      setTurns((current) => current.filter((turn) => turn.id !== id));
    } finally {
      setSending(false);
    }
  }

  async function finishCurrentLesson() {
    if (!activeLessonSessionId || finishingLesson) {
      return;
    }
    setFinishingLesson(true);
    setError(null);
    stopTutorSpeech();
    stopVoice();
    void stopRealtimeVoice(false);
    try {
      const finishedLesson = await api<TutorLessonHistoryItem>(
        `/tutor/lessons/${encodeURIComponent(activeLessonSessionId)}/finish`,
        { method: 'POST' },
      );
      conversationIdRef.current = undefined;
      setConversationId(undefined);
      setActiveLessonSessionId(undefined);
      setHistoryRecordLessonId(finishedLesson.lessonSessionId);
      setLessonType(finishedLesson.lessonType);
      setTurns(finishedLesson.turns);
      setUsageSummary((currentSummary) =>
        currentSummary ? { ...currentSummary, currentLesson: null } : currentSummary,
      );
      setContinuityNotice(t.tutor.continuity.finishedNotice);
      await refreshUsage(finishedLesson.lessonSessionId);
      await refreshLessonHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.tutor);
    } finally {
      setFinishingLesson(false);
    }
  }

  function startVoice(auto = false) {
    if (listening || recognitionRef.current) {
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      if (!auto) {
        setError(t.errors.speechUnsupported);
      }
      setVoiceStatus({
        tone: 'warning',
        text: t.tutor.voiceStatus.unsupported,
      });
      return;
    }
    manualVoiceStopRef.current = false;
    const recognition = new Recognition();
    recognition.lang = locale === 'ru' ? 'ru-RU' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    let finalText = '';
    let latestTranscript = '';
    let latestError: string | undefined;
    let completed = false;
    const finishRecognition = () => {
      if (completed) {
        return;
      }
      completed = true;
      setListening(false);
      setVoiceInterim('');
      recognitionRef.current = null;
      const spoken = getBestRecognizedSpeechText(finalText, latestTranscript);
      if (spoken) {
        autoVoiceRestartCountRef.current = 0;
        setVoiceStatus(null);
        void sendMessage(spoken, 'voice');
        return;
      }
      if (manualVoiceStopRef.current) {
        manualVoiceStopRef.current = false;
        autoVoiceRestartCountRef.current = 0;
        setVoiceStatus(null);
        return;
      }
      const canRetry =
        auto &&
        voiceOutputEnabledRef.current &&
        speechSupported &&
        shouldRetryVoiceInput(latestError) &&
        autoVoiceRestartCountRef.current < VOICE_MAX_AUTO_RESTARTS;
      if (canRetry) {
        autoVoiceRestartCountRef.current += 1;
        setVoiceStatus({ tone: 'warning', text: t.tutor.voiceStatus.retrying });
        window.setTimeout(() => startVoice(true), VOICE_AUTO_RESTART_DELAY_MS);
        return;
      }
      autoVoiceRestartCountRef.current = 0;
      setVoiceStatus({
        tone: 'warning',
        text: getVoiceStopMessage(latestError, t),
      });
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += ` ${transcript}`;
        } else {
          interim += transcript;
        }
      }
      latestTranscript = normalizeRecognizedSpeech(`${finalText} ${interim}`);
      setVoiceInterim(normalizeRecognizedSpeech(interim));
      setVoiceStatus({ tone: 'listening', text: t.tutor.voiceStatus.heard });
    };
    recognition.onerror = (event) => {
      const errorCode = (event as { error?: unknown }).error;
      latestError = typeof errorCode === 'string' ? errorCode : undefined;
      if (!auto && !isExpectedSpeechSilence(latestError)) {
        setError(t.errors.speechFailed);
      }
      finishRecognition();
    };
    recognition.onend = () => {
      finishRecognition();
    };
    recognitionRef.current = recognition;
    setListening(true);
    setVoiceStatus({
      tone: 'listening',
      text: auto ? t.tutor.voiceStatus.autoListening : t.tutor.voiceStatus.listening,
    });
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      if (!auto) {
        setError(t.errors.speechFailed);
      }
      setVoiceStatus({
        tone: 'warning',
        text: auto ? t.tutor.voiceStatus.restartBlocked : t.tutor.voiceStatus.browserStopped,
      });
    }
  }

  function stopVoice() {
    manualVoiceStopRef.current = true;
    autoVoiceRestartCountRef.current = 0;
    const recognition = recognitionRef.current;
    recognition?.stop();
    recognitionRef.current = null;
    setListening(false);
    setVoiceStatus(null);
  }

  async function startRealtimeVoice() {
    if (realtimeVoice.status === 'starting' || realtimeVoice.status === 'connected') {
      return;
    }
    if (viewingHistoryRecord) {
      setContinuityNotice(t.tutor.continuity.historyReadOnlyNotice);
      return;
    }
    if (!realtimeVoiceSupported) {
      setRealtimeVoice({
        status: 'error',
        text: t.tutor.realtimeVoice.unsupported,
      });
      return;
    }

    stopTutorSpeech();
    stopVoice();
    setError(null);
    setRealtimeVoice({ status: 'starting', text: t.tutor.realtimeVoice.connecting });

    let bootstrap: WebRtcBootstrapPayload | undefined;
    let localStream: MediaStream | undefined;
    let peerConnection: RTCPeerConnection | undefined;
    let remoteAudio: HTMLAudioElement | undefined;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      bootstrap = await api<WebRtcBootstrapPayload>('/webrtc/session', {
        method: 'POST',
        body: JSON.stringify({
          conversationSeed: conversationIdRef.current,
        }),
      });

      peerConnection = new RTCPeerConnection({ iceServers: bootstrap.iceServers });
      remoteAudio = new Audio();
      remoteAudio.autoplay = true;

      realtimeVoiceRef.current = {
        sessionId: bootstrap.sessionId,
        peerConnection,
        localStream,
        remoteAudio,
      };

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream || !remoteAudio) {
          return;
        }
        remoteAudio.srcObject = remoteStream;
        void remoteAudio.play().catch(() => {
          setRealtimeVoice((current) =>
            current.status === 'connected'
              ? { ...current, text: t.tutor.realtimeVoice.playbackBlocked }
              : current,
          );
        });
      };
      peerConnection.onconnectionstatechange = () => {
        if (!peerConnection) {
          return;
        }
        if (peerConnection.connectionState === 'connected') {
          setRealtimeVoice({
            status: 'connected',
            sessionId: bootstrap?.sessionId,
            model: bootstrap?.openaiRealtimeModel,
            text: t.tutor.realtimeVoice.connected,
          });
        }
        if (['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
          if (realtimeVoiceRef.current.sessionId === bootstrap?.sessionId) {
            void stopRealtimeVoice(false, t.tutor.realtimeVoice.disconnected);
          }
        }
      };

      for (const track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);
      const localDescription = peerConnection.localDescription;
      if (!localDescription?.sdp) {
        throw new Error(t.tutor.realtimeVoice.missingOffer);
      }

      const answer = await api<WebRtcOfferResponse>(
        `/webrtc/session/${encodeURIComponent(bootstrap.sessionId)}/offer`,
        {
          method: 'POST',
          body: JSON.stringify({ sdp: localDescription.sdp }),
        },
      );
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      setRealtimeVoice({
        status: 'connected',
        sessionId: bootstrap.sessionId,
        model: bootstrap.openaiRealtimeModel,
        text: t.tutor.realtimeVoice.connected,
      });
    } catch (err) {
      cleanupRealtimeVoiceRuntime({
        sessionId: bootstrap?.sessionId,
        peerConnection,
        localStream,
        remoteAudio,
      });
      if (bootstrap?.sessionId) {
        void api<WebRtcCloseResponse>(
          `/webrtc/session/${encodeURIComponent(bootstrap.sessionId)}/close`,
          { method: 'POST' },
        ).catch(() => undefined);
      }
      setRealtimeVoice({
        status: 'error',
        text: err instanceof Error ? err.message : t.tutor.realtimeVoice.failed,
      });
    }
  }

  async function stopRealtimeVoice(showStopped = true, statusText?: string) {
    const runtime = realtimeVoiceRef.current;
    if (!runtime.sessionId && !runtime.peerConnection && !runtime.localStream) {
      if (showStopped) {
        setRealtimeVoice({ status: 'idle', text: t.tutor.realtimeVoice.idle });
      }
      return;
    }

    const sessionId = runtime.sessionId;
    cleanupRealtimeVoiceRuntime(runtime);
    setRealtimeVoice({ status: 'stopping', sessionId, text: t.tutor.realtimeVoice.stopping });

    let closeResult: WebRtcCloseResponse | undefined;
    if (sessionId) {
      try {
        closeResult = await api<WebRtcCloseResponse>(
          `/webrtc/session/${encodeURIComponent(sessionId)}/close`,
          { method: 'POST' },
        );
      } catch {
        // Closing the local audio path is more important than blocking the UI on teardown.
      }
    }

    if (showStopped) {
      setRealtimeVoice({
        status: 'idle',
        text:
          statusText ??
          (closeResult?.transcript
            ? t.tutor.realtimeVoice.closedWithTranscript
            : t.tutor.realtimeVoice.closed),
      });
    } else {
      setRealtimeVoice({ status: 'idle', text: statusText ?? t.tutor.realtimeVoice.idle });
    }
  }

  function useQuickPrompt(text: string) {
    setDraft(text);
    textareaRef.current?.focus();
  }

  function toggleVoiceOutput(checked: boolean) {
    setVoiceOutputEnabled(checked);
    window.localStorage.setItem(VOICE_OUTPUT_STORAGE_KEY, checked ? 'true' : 'false');
    if (!checked) {
      stopTutorSpeech();
    }
  }

  function speakTutorAnswer(turnId: string, answer: TutorAnswer, continueDialog = false) {
    if (!speechOutputSupported) {
      setError(t.errors.speechOutputUnsupported);
      return;
    }
    const speechText = getTutorSpeechText(answer, t.tutor.imageAlt, locale);
    if (!speechText) {
      return;
    }
    autoListenAfterSpeechRef.current = false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = locale === 'ru' ? 'ru-RU' : 'en-US';
    utterance.voice = selectSpeechVoice(speechVoices, locale);
    utterance.rate = locale === 'ru' ? 0.92 : 0.96;
    utterance.pitch = locale === 'ru' ? 1.03 : 1;
    autoListenAfterSpeechRef.current = continueDialog && canContinueVoiceDialog(answer);
    utterance.onend = () => {
      setSpeakingTurnId((current) => (current === turnId ? null : current));
      if (
        autoListenAfterSpeechRef.current &&
        voiceOutputEnabledRef.current &&
        speechSupported &&
        canContinueVoiceDialog(answer)
      ) {
        autoListenAfterSpeechRef.current = false;
        window.setTimeout(() => startVoice(true), 250);
      }
    };
    utterance.onerror = () => {
      autoListenAfterSpeechRef.current = false;
      setSpeakingTurnId((current) => (current === turnId ? null : current));
      setError(t.errors.speechOutputFailed);
    };
    setSpeakingTurnId(turnId);
    window.speechSynthesis.speak(utterance);
  }

  function stopTutorSpeech() {
    autoListenAfterSpeechRef.current = false;
    window.speechSynthesis?.cancel();
    setSpeakingTurnId(null);
  }

  function startLauncherLesson(item: LessonLauncherItem) {
    clearLessonBoundary();
    setLessonType(item.lessonType);
    void sendMessage(item.prompt, 'text', item.lessonType, true);
  }

  function prepareLauncherLesson(item: LessonLauncherItem) {
    clearLessonBoundary();
    setLessonType(item.lessonType);
    setDraft(item.prompt);
    setVoiceInterim('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function generateImage(turn: TutorTurn, block: TutorImageBlock) {
    if (!block.prompt || turn.loadingImages?.[block.id] || viewingHistoryRecord) {
      return;
    }
    setTurns((current) =>
      current.map((item) =>
        item.id === turn.id
          ? {
              ...item,
              loadingImages: { ...(item.loadingImages ?? {}), [block.id]: true },
            }
          : item,
      ),
    );
    try {
      const result = await api<TutorImageResult>('/tutor/image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: block.prompt,
          context: turn.answer?.answer,
          conversationId: turn.answer?.conversationId,
          lessonSessionId: turn.answer?.lessonLifecycle?.lessonSessionId,
          lessonType: turn.answer?.lessonType ?? turn.lessonType,
          turnId: turn.answer?.turnId ?? turn.id,
          blockId: block.id,
        }),
      });
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id
            ? {
                ...item,
                answer: item.answer
                  ? updateAnswerImageBlock(item.answer, block.id, result.dataUrl)
                  : item.answer,
                imageUrls: { ...(item.imageUrls ?? {}), [block.id]: result.dataUrl },
                loadingImages: { ...(item.loadingImages ?? {}), [block.id]: false },
              }
            : item,
        ),
      );
      void refreshUsage(turn.answer?.lessonLifecycle?.lessonSessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.image);
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id
            ? {
                ...item,
                loadingImages: { ...(item.loadingImages ?? {}), [block.id]: false },
              }
            : item,
        ),
      );
    }
  }

  return (
    <Container size="lg" px={0} className="main-container">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1}>{t.tutor.title}</Title>
            <Text c="dimmed">{t.tutor.subtitle}</Text>
          </Box>
          <Group gap="xs">
            <Badge size="lg" variant="light" color={profile ? 'teal' : 'gray'}>
              {profile ? t.tutor.profileActive : t.tutor.baseMode}
            </Badge>
            <Badge
              size="lg"
              variant="light"
              color={viewingHistoryRecord ? 'gray' : conversationId ? 'teal' : 'gray'}
            >
              {viewingHistoryRecord
                ? t.tutor.historyRecord
                : conversationId
                ? t.tutor.conversationActive
                : t.tutor.newConversation}
            </Badge>
            {activeLessonSessionId && !viewingHistoryRecord && (
              <Button
                size="xs"
                color="orange"
                variant="light"
                loading={finishingLesson}
                leftSection={<Square size={14} />}
                onClick={() => void finishCurrentLesson()}
              >
                {t.tutor.finishLesson}
              </Button>
            )}
          </Group>
        </Group>

        <Box>
          <Text fw={800} mb={6}>
            {t.tutor.lessonMode}
          </Text>
          <SegmentedControl
            fullWidth
            value={lessonType}
            onChange={changeLessonType}
            disabled={viewingHistoryRecord}
            data={[
              { value: 'meeting', label: t.tutor.lessonModeOptions.meeting },
              { value: 'tutor', label: t.tutor.lessonModeOptions.tutor },
              { value: 'practice', label: t.tutor.lessonModeOptions.practice },
              { value: 'diagnostic', label: t.tutor.lessonModeOptions.diagnostic },
              { value: 'mistake_review', label: t.tutor.lessonModeOptions.mistake_review },
            ]}
          />
        </Box>

        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
          {t.tutor.stages.map((label, index) => (
            <Paper key={label} withBorder radius="md" p="sm" className="flow-step" data-active={index === 1}>
              <Text fw={900} ta="center">
                {label}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>

        <Group gap="xs" className="quick-row">
          {QUICK_PROMPTS[locale].map((prompt) => (
            <Pill
              key={prompt.label}
              className="quick-pill"
              onClick={() => {
                if (!viewingHistoryRecord) {
                  useQuickPrompt(prompt.text);
                }
              }}
              aria-disabled={sending || listening || viewingHistoryRecord}
            >
              {prompt.label}
            </Pill>
          ))}
        </Group>

        {historyLoaded && (
          <LessonContinuityPanel
            t={t}
            locale={locale}
            lessons={lessonHistory}
            activeLessonSessionId={activeLessonSessionId}
            loading={historyLoading}
            onResume={loadLessonFromHistory}
            onNewLesson={startNewLesson}
            onRefresh={() => void refreshLessonHistory()}
          />
        )}

        {continuityNotice && (
          <Alert color="teal" variant="light">
            {continuityNotice}
          </Alert>
        )}

        {viewingHistoryRecord && (
          <Alert color="gray" variant="light">
            <Group justify="space-between" gap="sm" align="center">
              <Text fw={700}>{t.tutor.continuity.historyReadOnlyNotice}</Text>
              <Button size="xs" variant="light" leftSection={<PlusCircle size={14} />} onClick={startNewLesson}>
                {t.tutor.continuity.newLesson}
              </Button>
            </Group>
          </Alert>
        )}

        <UsageBar
          t={t}
          locale={locale}
          summary={usageSummary}
          lifecycle={activeLifecycle}
          expanded={usageExpanded}
          refreshing={usageRefreshing}
          recoveringBackground={backgroundRecovering}
          onToggle={() => setUsageExpanded((current) => !current)}
          onRefresh={() => void refreshUsage(activeLessonSessionId)}
          onRecoverBackground={() => void recoverBackgroundJobs()}
        />

        <Card withBorder shadow="sm" padding="md" className="tutor-composer">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <Stack>
              <RealtimeVoicePanel
                t={t}
                state={realtimeVoice}
                supported={realtimeVoiceSupported}
                disabled={viewingHistoryRecord}
                onStart={() => void startRealtimeVoice()}
                onStop={() => void stopRealtimeVoice()}
              />
              <Textarea
                ref={textareaRef}
                value={listening ? voiceInterim || draft : draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                placeholder={
                  viewingHistoryRecord
                    ? t.tutor.continuity.historyReadOnlyPlaceholder
                    : t.tutor.placeholder
                }
                autosize
                minRows={3}
                maxRows={7}
                disabled={listening || viewingHistoryRecord}
                size="md"
              />
              <Group justify="space-between" gap="sm" align="center" className="voice-dialog-row">
                <Tooltip
                  label={
                    speechOutputSupported
                      ? t.tutor.voiceOutputHelp
                      : t.tutor.voiceOutputUnavailable
                  }
                >
                  <Switch
                    label={t.tutor.voiceOutput}
                    checked={voiceOutputEnabled && speechOutputSupported}
                    onChange={(event) => toggleVoiceOutput(event.currentTarget.checked)}
                    disabled={!speechOutputSupported}
                    size="md"
                  />
                </Tooltip>
                <Group justify="flex-end" gap="sm">
                  <Tooltip label={speechSupported ? t.tutor.voiceTitle : t.tutor.voiceUnavailable}>
                    <ActionIcon
                      size="xl"
                      variant={listening ? 'filled' : 'light'}
                      color={listening ? 'red' : 'teal'}
                      onClick={listening ? stopVoice : () => startVoice()}
                      disabled={
                        !speechSupported ||
                        sending ||
                        viewingHistoryRecord ||
                        realtimeVoice.status === 'connected' ||
                        realtimeVoice.status === 'starting'
                      }
                      title={speechSupported ? t.tutor.voiceTitle : t.tutor.voiceUnavailable}
                    >
                      {listening ? <Square size={18} /> : <Mic size={18} />}
                    </ActionIcon>
                  </Tooltip>
                  <Button
                    type="submit"
                    size="md"
                    color="teal"
                    loading={sending}
                    disabled={!draft.trim() || viewingHistoryRecord}
                    leftSection={<Send size={18} />}
                  >
                    {t.tutor.ask}
                  </Button>
                </Group>
              </Group>
              {voiceStatus && (
                <Group
                  gap="xs"
                  className={`voice-status voice-status-${voiceStatus.tone}`}
                  role="status"
                  aria-live="polite"
                >
                  <Mic size={14} />
                  <Text size="sm" fw={700}>
                    {voiceStatus.text}
                  </Text>
                </Group>
              )}
            </Stack>
          </form>
        </Card>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <Stack gap="md" ref={lessonFocusRef}>
          {turns.length === 0 && (
            <LessonLauncher
              t={t}
              items={launcherCards}
              sending={sending}
              listening={listening}
              onStart={startLauncherLesson}
              onPrepare={prepareLauncherLesson}
            />
          )}
          {turns.map((turn) => (
            <TutorTurnCard
              key={turn.id}
              t={t}
              turn={turn}
              speechOutputSupported={speechOutputSupported}
              speaking={speakingTurnId === turn.id}
              onSpeak={() => {
                if (turn.answer) {
                  speakTutorAnswer(turn.id, turn.answer, voiceOutputEnabled);
                }
              }}
              onStopSpeech={stopTutorSpeech}
              onGenerateImage={generateImage}
              readOnly={viewingHistoryRecord}
            />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}

function LessonLauncher({
  t,
  items,
  sending,
  listening,
  onStart,
  onPrepare,
}: {
  t: Copy;
  items: LessonLauncherItem[];
  sending: boolean;
  listening: boolean;
  onStart: (item: LessonLauncherItem) => void;
  onPrepare: (item: LessonLauncherItem) => void;
}) {
  const primaryItem = items.find((item) => item.id === 'meeting') ?? items[0];
  const disabled = sending || listening;

  return (
    <Box className="lesson-launcher">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Group gap="sm" align="flex-start" wrap="nowrap" className="lesson-launcher-copy">
            <ThemeIcon size="xl" radius="md" color="teal" variant="light">
              <Sparkles size={24} />
            </ThemeIcon>
            <Box>
              <Title order={2}>{t.tutor.emptyTitle}</Title>
              <Text c="dimmed">{t.tutor.emptyBody}</Text>
              <Text c="dimmed" size="sm" mt={4}>
                {t.tutor.launcher.body}
              </Text>
            </Box>
          </Group>
          {primaryItem && (
            <Button
              size="lg"
              color="green"
              className="lesson-start-button"
              leftSection={<PlayCircle size={20} />}
              onClick={() => onStart(primaryItem)}
              disabled={disabled}
            >
              {t.tutor.launcher.start}
            </Button>
          )}
        </Group>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }} spacing="sm">
          {items.map((item) => (
            <Paper key={item.id} withBorder radius="md" p="md" className="lesson-card">
              <Stack gap="sm" h="100%">
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <ThemeIcon variant="light" color={lessonLauncherColor(item.id)}>
                    {lessonLauncherIcon(item.id)}
                  </ThemeIcon>
                  <Text fw={900} className="break-anywhere">
                    {item.title}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed" className="lesson-card-body">
                  {item.body}
                </Text>
                <Button
                  fullWidth
                  mt="auto"
                  color={item.id === 'meeting' ? 'green' : 'teal'}
                  variant={item.startImmediately ? 'light' : 'default'}
                  onClick={() => (item.startImmediately ? onStart(item) : onPrepare(item))}
                  disabled={disabled}
                >
                  {item.action}
                </Button>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </Box>
  );
}

function RealtimeVoicePanel({
  t,
  state,
  supported,
  disabled,
  onStart,
  onStop,
}: {
  t: Copy;
  state: RealtimeVoiceState;
  supported: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const active = state.status === 'connected';
  const busy = state.status === 'starting' || state.status === 'stopping';
  const color = active ? 'green' : state.status === 'error' ? 'red' : 'teal';

  return (
    <Box className="realtime-voice-strip" data-active={active}>
      <Group justify="space-between" gap="sm" align="center">
        <Group gap="sm" wrap="nowrap" className="realtime-voice-copy">
          <ThemeIcon color={color} variant={active ? 'filled' : 'light'} radius="md">
            <Radio size={18} />
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Group gap="xs" align="center">
              <Text fw={900}>{t.tutor.realtimeVoice.title}</Text>
              <Badge color={color} variant="light">
                {t.tutor.realtimeVoice.statuses[state.status]}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" className="break-anywhere">
              {state.text ?? t.tutor.realtimeVoice.idle}
            </Text>
            {state.model && (
              <Text size="xs" c="dimmed" className="break-anywhere">
                {state.model}
              </Text>
            )}
          </Box>
        </Group>
        <Button
          color={active ? 'red' : 'green'}
          variant={active ? 'light' : 'filled'}
          loading={busy}
          disabled={disabled || (!supported && !active)}
          leftSection={active ? <Square size={16} /> : <Radio size={16} />}
          onClick={active ? onStop : onStart}
        >
          {active ? t.tutor.realtimeVoice.stop : t.tutor.realtimeVoice.start}
        </Button>
      </Group>
    </Box>
  );
}

function LessonContinuityPanel({
  t,
  locale,
  lessons,
  activeLessonSessionId,
  loading,
  onResume,
  onNewLesson,
  onRefresh,
}: {
  t: Copy;
  locale: Locale;
  lessons: TutorLessonHistoryItem[];
  activeLessonSessionId?: string;
  loading: boolean;
  onResume: (lesson: TutorLessonHistoryItem) => void;
  onNewLesson: () => void;
  onRefresh: () => void;
}) {
  const latestLesson = lessons.find((lesson) => !isTerminalLessonStatus(lesson.status));
  const latestLessonActive = latestLesson?.lessonSessionId === activeLessonSessionId;
  return (
    <Paper withBorder radius="md" p="md" className="lesson-continuity">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon size="lg" radius="md" color="teal" variant="light">
              <History size={20} />
            </ThemeIcon>
            <Box>
              <Text fw={900}>{t.tutor.continuity.title}</Text>
              <Text size="sm" c="dimmed">
                {t.tutor.continuity.subtitle}
              </Text>
            </Box>
          </Group>
          <Group gap="xs" justify="flex-end">
            {latestLesson && (
              <Button
                color={latestLessonActive ? 'teal' : 'green'}
                variant={latestLessonActive ? 'light' : 'filled'}
                leftSection={<PlayCircle size={16} />}
                onClick={() => onResume(latestLesson)}
              >
                {latestLessonActive
                  ? t.tutor.continuity.goToOpened
                  : t.tutor.continuity.resumeLatest}
              </Button>
            )}
            <Button variant="light" leftSection={<PlusCircle size={16} />} onClick={onNewLesson}>
              {t.tutor.continuity.newLesson}
            </Button>
            <ActionIcon
              variant="subtle"
              color="teal"
              onClick={onRefresh}
              loading={loading}
              title={t.common.refresh}
            >
              <RefreshCw size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {lessons.length === 0 ? (
          <Paper withBorder radius="md" p="md" className="lesson-history-empty">
            <Text fw={900}>{t.tutor.continuity.emptyTitle}</Text>
            <Text size="sm" c="dimmed">
              {t.tutor.continuity.emptyBody}
            </Text>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            {lessons.slice(0, 4).map((lesson) => {
              const active = lesson.lessonSessionId === activeLessonSessionId;
              const historical = isTerminalLessonStatus(lesson.status);
              const latestTurn = lesson.turns[0];
              return (
                <Box
                  key={lesson.lessonSessionId}
                  className="lesson-history-row"
                  data-active={active}
                >
                  <Group justify="space-between" gap="xs" align="flex-start">
                    <Group gap={6}>
                      <Badge color={lessonColor(lesson.lessonType)} variant="light">
                        {t.tutor.lessonModes[lesson.lessonType]}
                      </Badge>
                      <Badge color={lesson.goalStatus === 'reached' ? 'teal' : 'gray'} variant="light">
                        {formatGoalStatus(lesson.goalStatus, t)}
                      </Badge>
                    </Group>
                    {active && (
                      <Badge color="green" variant="filled">
                        {t.tutor.continuity.opened}
                      </Badge>
                    )}
                    {historical && (
                      <Badge color="gray" variant="light">
                        {t.tutor.continuity.finished}
                      </Badge>
                    )}
                  </Group>
                  <Text fw={900} mt="xs" className="break-anywhere">
                    {lesson.lessonGoal}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(lesson.updatedAt, locale)}
                    {' · '}
                    {lesson.turnCount} {t.tutor.continuity.turns}
                    {' · '}
                    {formatDuration(lesson.activeLearningSeconds)}
                  </Text>
                  <Text size="sm" mt="xs" className="lesson-history-summary">
                    {getLessonHistorySummary(lesson, t)}
                  </Text>
                  {latestTurn && (
                    <Box mt="xs" className="lesson-history-last-turn">
                      <Text size="xs" c="dimmed">
                        {t.tutor.continuity.lastQuestion}
                      </Text>
                      <Text size="sm" className="break-anywhere">
                        {latestTurn.prompt}
                      </Text>
                    </Box>
                  )}
                  <Button
                    fullWidth
                    mt="sm"
                    color={historical || active ? 'gray' : 'teal'}
                    variant={historical || active ? 'light' : 'filled'}
                    onClick={() => onResume(lesson)}
                  >
                    {historical
                      ? t.tutor.continuity.openRecord
                      : active
                      ? t.tutor.continuity.goToOpened
                      : t.tutor.continuity.resume}
                  </Button>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Paper>
  );
}

function lessonLauncherIcon(id: LessonLauncherItem['id']) {
  if (id === 'meeting') {
    return <Brain size={18} />;
  }
  if (id === 'diagnostic') {
    return <FileText size={18} />;
  }
  if (id === 'practice') {
    return <Sparkles size={18} />;
  }
  if (id === 'mistake') {
    return <Shield size={18} />;
  }
  return <BookOpen size={18} />;
}

function lessonLauncherColor(id: LessonLauncherItem['id']): string {
  if (id === 'diagnostic') {
    return 'indigo';
  }
  if (id === 'practice') {
    return 'orange';
  }
  if (id === 'mistake') {
    return 'red';
  }
  return 'teal';
}

function UsageBar({
  t,
  locale,
  summary,
  lifecycle,
  expanded,
  refreshing,
  recoveringBackground,
  onToggle,
  onRefresh,
  onRecoverBackground,
}: {
  t: Copy;
  locale: Locale;
  summary: UserUsageSummary | null;
  lifecycle?: TutorLessonLifecycle;
  expanded: boolean;
  refreshing: boolean;
  recoveringBackground: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  onRecoverBackground: () => void;
}) {
  const today = summary?.today ?? emptyUsageTotals();
  const lesson = summary?.currentLesson?.total ?? emptyUsageTotals();
  const details = summary?.currentLesson?.items ?? [];
  const decisions = summary?.currentLesson?.decisions ?? [];
  const backgroundJobs = summary?.backgroundJobs ?? [];
  const hasActiveBackgroundJobs = backgroundJobs.some((job) =>
    ['pending', 'running'].includes(job.status),
  );
  const hasFailedBackgroundJobs = backgroundJobs.some((job) => job.status === 'failed');
  const verifiedOutcomes = summary?.currentLesson?.verifiedOutcomes ?? 0;
  const costPerVerifiedOutcome = summary?.currentLesson?.costPerVerifiedOutcomeUsd ?? null;
  const needsPricingNote =
    !today.pricingConfigured &&
    (today.totalTokens > 0 || today.imageCount > 0 || lesson.totalTokens > 0 || lesson.imageCount > 0);

  return (
    <Paper withBorder radius="md" p="sm" className="usage-bar">
      <Stack gap="xs">
        <Group justify="space-between" align="center" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="teal">
              <Sparkles size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={900}>{t.tutor.usage.title}</Text>
              <Text size="xs" c="dimmed">
                {needsPricingNote
                  ? t.tutor.usage.pricingNotConfigured
                  : hasActiveBackgroundJobs
                    ? t.tutor.usage.autoRefreshing
                    : t.tutor.usage.subtitle}
              </Text>
            </Box>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Button
              variant="light"
              size="xs"
              leftSection={<RefreshCw size={14} />}
              loading={refreshing}
              onClick={onRefresh}
            >
              {t.tutor.usage.refresh}
            </Button>
            <Button variant="subtle" size="xs" onClick={onToggle}>
              {expanded ? t.tutor.usage.hideDetails : t.tutor.usage.details}
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
          <UsageMetric label={t.tutor.usage.today} value={formatUsageCost(today)} />
          <UsageMetric label={t.tutor.usage.lesson} value={formatUsageCost(lesson)} />
          <UsageMetric
            label={t.tutor.usage.goal}
            value={
              lifecycle
                ? t.tutor.usage.goalStatuses[lifecycle.goalStatus]
                : t.tutor.usage.noData
            }
          />
          <UsageMetric
            label={t.tutor.usage.time}
            value={
              lifecycle
                ? `${formatDuration(lifecycle.activeLearningSeconds)} / ${formatDuration(lifecycle.dayActiveLearningSeconds)}`
                : t.tutor.usage.noData
            }
          />
          <UsageMetric
            label={t.tutor.usage.evidence}
            value={lifecycle ? lifecycle.goalEvidenceLevel : t.tutor.usage.noData}
          />
          <UsageMetric
            label={t.tutor.usage.verified}
            value={verifiedOutcomes.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
          />
          <UsageMetric
            label={t.tutor.usage.costPerOutcome}
            value={
              costPerVerifiedOutcome === null
                ? t.tutor.usage.noData
                : formatCurrency(costPerVerifiedOutcome)
            }
          />
        </SimpleGrid>

        {lifecycle?.shouldSuggestBreak && (
          <Alert color={lifecycle.shouldStop ? 'red' : 'yellow'} variant="light">
            {lifecycle.shouldStop ? t.tutor.usage.stopRecommended : t.tutor.usage.breakRecommended}
          </Alert>
        )}

        {expanded && (
          <Box className="usage-details">
            {details.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t.tutor.usage.noDetails}
              </Text>
            ) : (
              <Table striped highlightOnHover withTableBorder={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t.tutor.usage.operation}</Table.Th>
                    <Table.Th>{t.tutor.usage.model}</Table.Th>
                    <Table.Th>{t.tutor.usage.tokens}</Table.Th>
                    <Table.Th>{t.tutor.usage.images}</Table.Th>
                    <Table.Th>{t.tutor.usage.cost}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {details.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Text size="sm" fw={700}>
                          {item.operation}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.assistantRole}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" className="break-anywhere">
                          {item.model}
                        </Text>
                        {item.serviceTier && (
                          <Text size="xs" c="dimmed">
                            {item.serviceTier}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {item.totalTokens.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t.tutor.usage.input}: {item.inputTokens.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                          {' / '}
                          {t.tutor.usage.output}: {item.outputTokens.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                        </Text>
                      </Table.Td>
                      <Table.Td>{item.imageCount}</Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {formatUsageCost({
                            estimatedCostUsd: item.estimatedCostUsd,
                            inputTokens: item.inputTokens,
                            cachedInputTokens: item.cachedInputTokens,
                            outputTokens: item.outputTokens,
                            totalTokens: item.totalTokens,
                            imageCount: item.imageCount,
                            pricingConfigured: item.pricingSource !== 'not_configured',
                          })}
                        </Text>
                        <Text size="xs" c="dimmed" className="break-anywhere">
                          {item.pricingSource === 'not_configured'
                            ? t.tutor.usage.pricingMissingShort
                            : item.pricingSource}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            {decisions.length > 0 && (
              <>
                <Divider my="sm" />
                <Text size="sm" fw={900} mb="xs">
                  {t.tutor.usage.decisions}
                </Text>
                <Table striped highlightOnHover withTableBorder={false}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t.tutor.usage.tool}</Table.Th>
                      <Table.Th>{t.tutor.usage.result}</Table.Th>
                      <Table.Th>{t.tutor.usage.evidence}</Table.Th>
                      <Table.Th>{t.tutor.usage.latency}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {decisions.slice(0, 8).map((decision) => (
                      <Table.Tr key={decision.id}>
                        <Table.Td>
                          <Text size="sm" fw={700} className="break-anywhere">
                            {decision.toolName}
                          </Text>
                          {decision.lessonOutcome && (
                            <Text size="xs" c="dimmed" className="break-anywhere">
                              {decision.lessonOutcome}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={decision.accepted ? 'teal' : 'red'} variant="light">
                            {decision.accepted ? t.tutor.usage.accepted : t.tutor.usage.rejected}
                          </Badge>
                          {decision.rejectionReason && (
                            <Text size="xs" c="dimmed" className="break-anywhere">
                              {decision.rejectionReason}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" className="break-anywhere">
                            {decision.evidenceLevel}
                          </Text>
                          {decision.verifierResult && (
                            <Text size="xs" c="dimmed">
                              {decision.verifierResult}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {decision.latencyMs}
                          {' ms'}
                          {decision.fallbackUsed && (
                            <Text size="xs" c="dimmed">
                              {t.tutor.usage.fallback}
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}
            <Divider my="sm" />
            <Group justify="space-between" align="center" mb="xs">
              <Text size="sm" fw={900}>
                {t.tutor.usage.backgroundJobs}
              </Text>
              {hasFailedBackgroundJobs && (
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  leftSection={
                    recoveringBackground ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />
                  }
                  loading={recoveringBackground}
                  onClick={onRecoverBackground}
                >
                  {t.tutor.usage.retryFailed}
                </Button>
              )}
            </Group>
            {backgroundJobs.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t.tutor.usage.noBackgroundJobs}
              </Text>
            ) : (
              <Table striped highlightOnHover withTableBorder={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t.tutor.usage.job}</Table.Th>
                    <Table.Th>{t.tutor.usage.status}</Table.Th>
                    <Table.Th>{t.tutor.usage.response}</Table.Th>
                    <Table.Th>{t.tutor.usage.updated}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {backgroundJobs.map((job) => (
                    <Table.Tr key={job.id}>
                      <Table.Td>
                        <Text size="sm" fw={700} className="break-anywhere">
                          {job.type}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t.tutor.usage.attempts}: {job.attempts}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={backgroundJobStatusColor(job.status)} variant="light">
                          {job.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {job.resultPreview ? (
                          <Text size="sm" className="break-anywhere">
                            {job.resultPreview}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            {t.tutor.usage.noBackgroundResponse}
                          </Text>
                        )}
                        {job.errorMessage && (
                          <Text size="xs" c="red" className="break-anywhere">
                            {job.errorMessage}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" className="break-anywhere">
                          {job.updatedAt}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <Paper withBorder radius="md" p="xs" className="usage-metric">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={900} className="break-anywhere">
        {value}
      </Text>
    </Paper>
  );
}

function TutorTurnCard({
  t,
  turn,
  speechOutputSupported,
  speaking,
  onSpeak,
  onStopSpeech,
  onGenerateImage,
  readOnly,
}: {
  t: Copy;
  turn: TutorTurn;
  speechOutputSupported: boolean;
  speaking: boolean;
  onSpeak: () => void;
  onStopSpeech: () => void;
  onGenerateImage: (turn: TutorTurn, block: TutorImageBlock) => Promise<void>;
  readOnly: boolean;
}) {
  return (
    <Card withBorder shadow="sm" padding="lg" className="turn-card">
      <Stack>
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <Badge variant="light" color={turn.source === 'voice' ? 'indigo' : 'teal'}>
            {turn.source === 'voice' ? t.common.voice : t.common.text}
          </Badge>
          <Badge variant="light" color={lessonColor(turn.lessonType)}>
            {t.tutor.lessonModes[turn.lessonType]}
          </Badge>
          <Text fw={900} className="break-anywhere">
            {turn.prompt}
          </Text>
        </Group>

        {!turn.answer && (
          <Group gap="xs" c="dimmed">
            <Loader2 className="spin" size={18} />
            <Text>{t.tutor.thinking}</Text>
          </Group>
        )}

        {turn.answer && (
          <Stack gap="lg">
            <Group justify="flex-end">
              <Tooltip
                label={
                  speechOutputSupported
                    ? speaking
                      ? t.tutor.stopSpeaking
                      : t.tutor.speakAnswer
                    : t.tutor.voiceOutputUnavailable
                }
              >
                <Button
                  size="xs"
                  variant={speaking ? 'filled' : 'light'}
                  color={speaking ? 'red' : 'teal'}
                  leftSection={speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  onClick={speaking ? onStopSpeech : onSpeak}
                  disabled={!speechOutputSupported}
                >
                  {speaking ? t.tutor.stopSpeaking : t.tutor.speakAnswer}
                </Button>
              </Tooltip>
            </Group>
            <TutorBlockList
              t={t}
              turn={turn}
              onGenerateImage={onGenerateImage}
              readOnly={readOnly}
            />

            {turn.answer.citations.length > 0 && (
              <Box>
                <Text fw={800} size="sm" mb={6}>
                  {t.tutor.citations}
                </Text>
                <Group gap={6}>
                  {turn.answer.citations.map((citation) => (
                    <Badge key={citation.fileId} color="gray" variant="light">
                      {citation.filename ?? citation.fileId}
                    </Badge>
                  ))}
                </Group>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function emptyUsageTotals(): UsageTotals {
  return {
    estimatedCostUsd: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    imageCount: 0,
    pricingConfigured: false,
  };
}

function formatUsageCost(totals: UsageTotals): string {
  const hasUsage = totals.totalTokens > 0 || totals.imageCount > 0;
  return `${formatCurrency(totals.estimatedCostUsd)}${
    hasUsage && !totals.pricingConfigured ? '*' : ''
  }`;
}

function formatCurrency(value: number): string {
  if (value > 0 && value < 0.0001) {
    return '<$0.0001';
  }
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function backgroundJobStatusColor(status: string): string {
  if (status === 'succeeded') {
    return 'teal';
  }
  if (status === 'failed') {
    return 'red';
  }
  if (status === 'running') {
    return 'blue';
  }
  return 'gray';
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${minutes}m`;
}

function formatGoalStatus(status: TutorLessonHistoryItem['goalStatus'], t: Copy): string {
  return t.tutor.usage.goalStatuses[status] ?? status;
}

function isTerminalLessonStatus(
  status: TutorLessonHistoryItem['status'] | TutorLessonLifecycle['status'],
): boolean {
  return status === 'hard_limit_reached' || status === 'goal_reached' || status === 'finished';
}

function getLessonHistorySummary(lesson: TutorLessonHistoryItem, t: Copy): string {
  const summary = pickSummaryText(lesson.summary);
  if (summary) {
    return summary;
  }
  const latestAnswer = lesson.turns[0]?.answer?.answer?.trim();
  if (latestAnswer) {
    return latestAnswer.slice(0, 220);
  }
  return t.tutor.continuity.noSummary;
}

function pickSummaryText(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  for (const key of ['summary', 'text', 'goalProgress', 'nextStep']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 220);
    }
  }
  for (const candidate of Object.values(value)) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 220);
    }
  }
  return undefined;
}

function TutorBlockList({
  t,
  turn,
  onGenerateImage,
  readOnly,
}: {
  t: Copy;
  turn: TutorTurn;
  onGenerateImage: (turn: TutorTurn, block: TutorImageBlock) => Promise<void>;
  readOnly: boolean;
}) {
  if (!turn.answer) {
    return null;
  }

  const blocks = getTutorBlocks(turn.answer, t.tutor.imageAlt);
  return (
    <Stack gap="md">
      {blocks.map((block, index) => (
        <TutorBlock
          key={block.id}
          t={t}
          turn={turn}
          block={block}
          showTextTitle={index === 0 && block.type === 'text'}
          onGenerateImage={onGenerateImage}
          readOnly={readOnly}
        />
      ))}
    </Stack>
  );
}

function TutorBlock({
  t,
  turn,
  block,
  showTextTitle,
  onGenerateImage,
  readOnly,
}: {
  t: Copy;
  turn: TutorTurn;
  block: TutorResponseBlock;
  showTextTitle: boolean;
  onGenerateImage: (turn: TutorTurn, block: TutorImageBlock) => Promise<void>;
  readOnly: boolean;
}) {
  if (block.type === 'text') {
    return (
      <Box>
        {showTextTitle && (
          <Title order={3} mb={6}>
            {t.tutor.explanation}
          </Title>
        )}
        <Text className="prewrap" lh={1.65}>
          {block.text}
        </Text>
      </Box>
    );
  }

  if (block.type === 'task') {
    return (
      <Paper withBorder radius="md" p="md" className="task-panel">
        <Group justify="space-between" align="flex-start" mb={8}>
          <Text fw={900}>{block.title}</Text>
          {block.difficulty && (
            <Badge color="orange" variant="light">
              {block.difficulty}
            </Badge>
          )}
        </Group>
        <Text className="break-anywhere" lh={1.5}>
          {block.prompt}
        </Text>
      </Paper>
    );
  }

  if (block.type === 'example') {
    return (
      <Paper withBorder radius="md" p="md" className="example-panel">
        <Text fw={900} mb={6}>
          {block.title}
        </Text>
        <Text className="break-anywhere" lh={1.5}>
          {block.explanation}
        </Text>
      </Paper>
    );
  }

  const imageUrl = block.url ?? turn.imageUrls?.[block.id];
  const loading = Boolean(turn.loadingImages?.[block.id]);
  return (
    <Paper withBorder radius="md" p="md" className="image-block">
      <Group gap="sm" align="flex-start" mb={imageUrl ? 'sm' : 0}>
        <ThemeIcon color="teal" variant="light" size="lg">
          <ImageIcon size={18} />
        </ThemeIcon>
        <Box className="image-block-copy">
          <Text fw={900}>{block.caption}</Text>
          {!imageUrl && (
            <Text size="sm" c="dimmed" className="break-anywhere">
              {block.prompt}
            </Text>
          )}
        </Box>
      </Group>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={block.altText || t.tutor.imageAlt}
          radius="md"
          className="generated-image"
        />
      ) : (
        <Button
          mt="sm"
          variant="filled"
          color="teal"
          leftSection={loading ? <Loader2 className="spin" size={18} /> : <ImageIcon size={18} />}
          onClick={() => void onGenerateImage(turn, block)}
          disabled={loading || readOnly}
        >
          {t.tutor.showImage}
        </Button>
      )}
    </Paper>
  );
}

function getTutorBlocks(answer: TutorAnswer, imageAlt: string): TutorResponseBlock[] {
  if (Array.isArray(answer.blocks) && answer.blocks.length > 0) {
    const blocks = [...answer.blocks];
    const hasImageBlock = blocks.some((block) => block.type === 'image');
    if (!hasImageBlock && answer.needsImage && answer.imagePrompt) {
      blocks.push({
        id: 'image-1',
        type: 'image',
        status: 'suggested',
        prompt: answer.imagePrompt,
        caption: imageAlt,
        altText: imageAlt,
        priority: 'optional',
      });
    }
    return blocks;
  }

  const blocks: TutorResponseBlock[] = [];
  if (answer.answer.trim()) {
    blocks.push({ id: 'text-1', type: 'text', text: answer.answer });
  }
  answer.tasks.forEach((task, index) => {
    blocks.push({
      id: `task-${index + 1}`,
      type: 'task',
      title: task.title,
      prompt: task.prompt,
      difficulty: task.difficulty,
    });
  });
  answer.examples.forEach((example, index) => {
    blocks.push({
      id: `example-${index + 1}`,
      type: 'example',
      title: example.title,
      explanation: example.explanation,
    });
  });
  if (answer.needsImage && answer.imagePrompt) {
    blocks.push({
      id: 'image-1',
      type: 'image',
      status: 'suggested',
      prompt: answer.imagePrompt,
      caption: imageAlt,
      altText: imageAlt,
      priority: 'optional',
    });
  }
  return blocks;
}

function shouldAutoGenerateImage(
  turn: TutorTurn,
  block: TutorImageBlock,
  autoTurnIds: Set<string>,
): boolean {
  const turnKey = turn.answer?.turnId ?? turn.id;
  if (!autoTurnIds.has(turnKey)) {
    return false;
  }
  if (block.priority !== 'required' || !block.prompt || block.url || turn.imageUrls?.[block.id]) {
    return false;
  }
  return !turn.loadingImages?.[block.id];
}

function imageGenerationKey(turn: TutorTurn, block: TutorImageBlock): string {
  return `${turn.answer?.turnId ?? turn.id}:${block.id}:${block.prompt}`;
}

function updateAnswerImageBlock(
  answer: TutorAnswer,
  blockId: string,
  dataUrl: string,
): TutorAnswer {
  const blocks = getTutorBlocks(answer, '').map((block) =>
    block.type === 'image' && block.id === blockId
      ? {
          ...block,
          status: 'ready' as const,
          url: dataUrl,
        }
      : block,
  );
  return {
    ...answer,
    blocks,
    needsImage: true,
  };
}

function getTutorSpeechText(answer: TutorAnswer, imageAlt: string, locale: Locale): string {
  const parts = getTutorBlocks(answer, imageAlt)
    .map((block) => {
      if (block.type === 'text') {
        return block.text;
      }
      if (block.type === 'example') {
        return `${block.title}. ${block.explanation}`;
      }
      if (block.type === 'task') {
        return `${block.title}. ${block.prompt}`;
      }
      if (block.type === 'image') {
        return block.caption;
      }
      return '';
    })
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const text = normalizeTutorSpeechText(parts.join(' '), locale);
  if (text.length <= MAX_SPEECH_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_SPEECH_TEXT_LENGTH).trim()}...`;
}

function selectSpeechVoice(
  voices: SpeechSynthesisVoice[],
  locale: Locale,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) {
    return null;
  }

  const languagePrefix = locale === 'ru' ? 'ru' : 'en';
  const preferredNames =
    locale === 'ru'
      ? ['google русский', 'microsoft svetlana', 'microsoft irina', 'milena', 'russian']
      : ['google us english', 'microsoft aria', 'samantha', 'english'];
  const languageMatches = voices
    .filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix))
    .map((voice) => {
      const name = voice.name.toLowerCase();
      const preferredIndex = preferredNames.findIndex((candidate) => name.includes(candidate));
      return {
        voice,
        score:
          (preferredIndex === -1 ? 0 : 30 - preferredIndex) +
          (voice.localService ? 2 : 0) +
          (voice.default ? 1 : 0),
      };
    })
    .sort((left, right) => right.score - left.score);

  return languageMatches[0]?.voice ?? voices.find((voice) => voice.default) ?? voices[0] ?? null;
}

function normalizeTutorSpeechText(text: string, locale: Locale): string {
  let normalized = text
    .replace(/\bf\s*\(\s*[xх]\s*\)/gi, locale === 'ru' ? 'эф от икс' : 'f of x')
    .replace(/\bf[’']\s*\(\s*[xх]\s*\)/gi, locale === 'ru' ? 'эф штрих от икс' : 'f prime of x')
    .replace(/\b([xх])\s*\^\s*2\b/gi, locale === 'ru' ? '$1 в квадрате' : '$1 squared')
    .replace(/\b([xх])\s*²/gi, locale === 'ru' ? '$1 в квадрате' : '$1 squared')
    .replace(/\b([xх])\s*\^\s*3\b/gi, locale === 'ru' ? '$1 в кубе' : '$1 cubed')
    .replace(/\b([xх])\s*³/gi, locale === 'ru' ? '$1 в кубе' : '$1 cubed')
    .replace(/\b(\d+)\s*([xх])\b/gi, locale === 'ru' ? '$1 икс' : '$1 x')
    .replace(/\b([xх])\b/gi, locale === 'ru' ? 'икс' : 'x')
    .replace(/\s*=\s*/g, locale === 'ru' ? ' равно ' : ' equals ')
    .replace(/\s*[→⇒]\s*/g, locale === 'ru' ? ' значит ' : ' means ')
    .replace(/[–—]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  if (locale === 'ru') {
    normalized = normalized
      .replace(/\bЕГЭ\b/g, 'Е Г Э')
      .replace(/\bНачнем\b/g, 'Начнём')
      .replace(/\bначнем\b/g, 'начнём')
      .replace(/\bеще\b/gi, 'ещё')
      .replace(/\bлегк/g, 'лёгк')
      .replace(/\bберем\b/gi, 'берём')
      .replace(/\bнайдем\b/gi, 'найдём');
  }

  return normalized;
}

function shouldRetryVoiceInput(error: string | undefined): boolean {
  return !error || error === 'no-speech' || error === 'aborted';
}

function normalizeRecognizedSpeech(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function getBestRecognizedSpeechText(finalText: string, latestTranscript: string): string {
  const finalSpeech = normalizeRecognizedSpeech(finalText);
  const latestSpeech = normalizeRecognizedSpeech(latestTranscript);
  if (!finalSpeech) {
    return latestSpeech;
  }
  if (!latestSpeech) {
    return finalSpeech;
  }
  return latestSpeech.length > finalSpeech.length ? latestSpeech : finalSpeech;
}

function waitForIceGatheringComplete(peerConnection: RTCPeerConnection): Promise<void> {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      peerConnection.removeEventListener('icegatheringstatechange', onStateChange);
      resolve();
    }, REALTIME_ICE_GATHERING_TIMEOUT_MS);
    const onStateChange = () => {
      if (peerConnection.iceGatheringState !== 'complete') {
        return;
      }
      window.clearTimeout(timeout);
      peerConnection.removeEventListener('icegatheringstatechange', onStateChange);
      resolve();
    };
    peerConnection.addEventListener('icegatheringstatechange', onStateChange);
  });
}

function cleanupRealtimeVoiceRuntime(runtime: RealtimeVoiceRuntime): void {
  const localStream = runtime.localStream;
  const peerConnection = runtime.peerConnection;
  const remoteAudio = runtime.remoteAudio;

  runtime.sessionId = undefined;
  runtime.peerConnection = undefined;
  runtime.localStream = undefined;
  runtime.remoteAudio = undefined;

  localStream?.getTracks().forEach((track) => track.stop());
  if (peerConnection) {
    peerConnection.onconnectionstatechange = null;
    peerConnection.ontrack = null;
    peerConnection.close();
  }
  if (remoteAudio) {
    remoteAudio.pause();
    remoteAudio.srcObject = null;
  }
}

function isExpectedSpeechSilence(error: string | undefined): boolean {
  return !error || error === 'no-speech' || error === 'aborted';
}

function getVoiceStopMessage(error: string | undefined, t: Copy): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return t.tutor.voiceStatus.permissionBlocked;
  }
  if (error === 'audio-capture') {
    return t.tutor.voiceStatus.noMicrophone;
  }
  if (error === 'network') {
    return t.tutor.voiceStatus.network;
  }
  if (error === 'language-not-supported') {
    return t.tutor.voiceStatus.languageUnsupported;
  }
  if (error === 'no-speech' || error === 'aborted' || !error) {
    return t.tutor.voiceStatus.silenceStopped;
  }
  return t.tutor.voiceStatus.browserStopped;
}

function toLessonType(value: string): LessonType {
  return isLessonType(value) ? value : 'tutor';
}

function isLessonType(value: string): value is LessonType {
  return [
    'meeting',
    'tutor',
    'concept',
    'practice',
    'diagnostic',
    'exam_strategy',
    'mistake_review',
    'visual_explanation',
    'reflection',
  ].includes(value);
}

function isTerminalTutorAnswer(answer: TutorAnswer): boolean {
  const lifecycle = answer.lessonLifecycle;
  return Boolean(
    lifecycle?.shouldStop ||
      lifecycle?.goalStatus === 'reached' ||
      (lifecycle?.status && isTerminalLessonStatus(lifecycle.status)),
  );
}

function canContinueVoiceDialog(answer: TutorAnswer): boolean {
  return !isTerminalTutorAnswer(answer);
}

function lessonColor(lessonType: LessonType): string {
  if (lessonType === 'practice') {
    return 'orange';
  }
  if (lessonType === 'diagnostic') {
    return 'indigo';
  }
  if (lessonType === 'mistake_review') {
    return 'red';
  }
  return 'teal';
}

function SettingsView({
  user,
  locale,
  t,
  profile,
  onLocaleChange,
}: {
  user: User;
  locale: Locale;
  t: Copy;
  profile: StudentProfile | null;
  onLocaleChange: (locale: Locale) => void;
}) {
  const onboardingRows = profile
    ? [
        { label: t.settings.targetScore, value: profile.onboardingAnswers.targetScore },
        { label: t.settings.currentLevel, value: profile.onboardingAnswers.currentLevel },
        { label: t.settings.mathFeeling, value: profile.onboardingAnswers.mathFeeling },
        { label: t.settings.weakTopics, value: profile.onboardingAnswers.weakTopics },
        { label: t.settings.explanationStyle, value: profile.onboardingAnswers.explanationStyle },
        { label: t.settings.pacing, value: profile.onboardingAnswers.pacing },
        { label: t.settings.visualPreference, value: profile.onboardingAnswers.visualPreference },
        { label: t.settings.practicePreference, value: profile.onboardingAnswers.practicePreference },
        { label: t.settings.analogyInterests, value: profile.onboardingAnswers.analogyInterests },
      ]
    : [];

  return (
    <Container size="lg" px={0} className="main-container">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1}>{t.settings.title}</Title>
            <Text c="dimmed">{t.settings.subtitle}</Text>
          </Box>
          <Badge size="lg" variant="light" color="teal">
            {t.settings.localOnly}
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card withBorder shadow="sm" padding="md" className="settings-card">
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="teal">
                  <Languages size={18} />
                </ThemeIcon>
                <Box>
                  <Title order={3}>{t.settings.interfaceTitle}</Title>
                  <Text size="sm" c="dimmed">
                    {t.settings.interfaceSubtitle}
                  </Text>
                </Box>
              </Group>
              <Group justify="space-between" align="center">
                <Box>
                  <Text fw={800}>{t.settings.language}</Text>
                  <Text size="sm" c="dimmed">
                    {t.settings.languageHelp}
                  </Text>
                </Box>
                <LanguageSwitch locale={locale} t={t} onChange={onLocaleChange} />
              </Group>
              <SettingRow
                label={t.settings.voiceLanguage}
                value={locale === 'ru' ? 'ru-RU' : 'en-US'}
                t={t}
              />
              <Text size="sm" c="dimmed">
                {t.settings.voiceLanguageHelp}
              </Text>
            </Stack>
          </Card>

          <Card withBorder shadow="sm" padding="md" className="settings-card">
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="indigo">
                  <UserIcon size={18} />
                </ThemeIcon>
                <Box>
                  <Title order={3}>{t.settings.accountTitle}</Title>
                  <Text size="sm" c="dimmed">
                    {t.settings.accountSubtitle}
                  </Text>
                </Box>
              </Group>
              <SettingRow label={t.settings.name} value={user.name} t={t} />
              <SettingRow
                label={t.settings.role}
                value={user.role === 'admin' ? t.common.admin : t.common.student}
                t={t}
              />
              <SettingRow
                label={t.settings.createdAt}
                value={formatDateTime(user.createdAt, locale)}
                t={t}
              />
            </Stack>
          </Card>
        </SimpleGrid>

        <Card withBorder shadow="sm" padding="md" className="settings-card">
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon variant="light" color={profile ? 'teal' : 'gray'}>
                <Brain size={18} />
              </ThemeIcon>
              <Box>
                <Title order={3}>{t.settings.profileTitle}</Title>
                <Text size="sm" c="dimmed">
                  {profile ? t.settings.profileSubtitle : t.settings.noProfile}
                </Text>
              </Box>
            </Group>

            {profile ? (
              <Stack gap="md">
                <Paper withBorder radius="md" p="md" className="profile-summary">
                  <Text fw={900} mb={6}>
                    {t.settings.aiSummary}
                  </Text>
                  <Text className="prewrap" lh={1.55}>
                    {profile.aiSummary || t.settings.emptyValue}
                  </Text>
                  <Group gap="xs" mt="sm">
                    <Badge color="teal" variant="light">
                      {t.settings.completedAt}: {formatDateTime(profile.onboardingCompletedAt, locale)}
                    </Badge>
                    <Badge color="indigo" variant="light">
                      {t.settings.updatedAt}: {formatDateTime(profile.updatedAt, locale)}
                    </Badge>
                  </Group>
                </Paper>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  <SettingsPanel title={t.settings.firstMeetingAnswers} rows={onboardingRows} t={t} />
                  <SettingsPanel
                    title={t.settings.knowledgeState}
                    rows={rowsFromRecord(profile.knowledgeState)}
                    t={t}
                  />
                  <SettingsPanel
                    title={t.settings.learningPreferences}
                    rows={rowsFromRecord(profile.learningPreferences)}
                    t={t}
                  />
                  <SettingsPanel
                    title={t.settings.explanationStrategy}
                    rows={rowsFromRecord(profile.explanationStrategy)}
                    t={t}
                  />
                  <SettingsPanel
                    title={t.settings.teachingHypotheses}
                    rows={rowsFromRecord(profile.psychologicalProfile)}
                    t={t}
                  />
                  <SettingsPanel
                    title={t.settings.recentSessions}
                    rows={rowsFromSessionSummaries(profile.recentSessionSummaries, locale, t)}
                    t={t}
                  />
                  <SettingsPanel
                    title={t.settings.skillProgress}
                    rows={rowsFromSkillProgress(profile.skillProgress, locale, t)}
                    t={t}
                  />
                </SimpleGrid>

                <Alert color="yellow" variant="light">
                  {t.settings.profileSafetyNote}
                </Alert>
              </Stack>
            ) : (
              <Paper withBorder radius="md" p="md" className="empty-state">
                <ThemeIcon size="xl" variant="light" color="gray">
                  <Brain size={28} />
                </ThemeIcon>
                <Text fw={800}>{t.settings.noProfileTitle}</Text>
                <Text c="dimmed" size="sm" ta="center">
                  {t.settings.noProfileBody}
                </Text>
              </Paper>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

function SettingRow({ label, value, t }: { label: string; value: unknown; t: Copy }) {
  return (
    <Paper withBorder radius="md" p="sm" className="setting-row">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={800} className="break-anywhere">
        {formatSettingValue(value, t.settings.emptyValue, t)}
      </Text>
    </Paper>
  );
}

function SettingsPanel({
  title,
  rows,
  t,
}: {
  title: string;
  rows: { label: string; value: unknown }[];
  t: Copy;
}) {
  const visibleRows = rows.filter((row) => hasSettingValue(row.value));
  return (
    <Paper withBorder radius="md" p="md" className="settings-panel">
      <Text fw={900} mb="xs">
        {title}
      </Text>
      {visibleRows.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t.settings.emptyValue}
        </Text>
      ) : (
        <Stack gap={8}>
          {visibleRows.map((row) => (
            <Box key={row.label}>
              <Text size="xs" c="dimmed">
                {humanizeKey(row.label)}
              </Text>
              <Text size="sm" fw={700} className="break-anywhere">
                {formatSettingValue(row.value, t.settings.emptyValue, t)}
              </Text>
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function rowsFromRecord(record: Record<string, unknown>): { label: string; value: unknown }[] {
  return Object.entries(record ?? {}).map(([label, value]) => ({ label, value }));
}

function rowsFromSessionSummaries(
  summaries: StudentProfile['recentSessionSummaries'],
  locale: Locale,
  t: Copy,
): { label: string; value: unknown }[] {
  return summaries.map((summary, index) => ({
    label: `${t.settings.session} ${index + 1}`,
    value: {
      lessonType: t.tutor.lessonModes[summary.lessonType],
      createdAt: formatDateTime(summary.createdAt, locale),
      ...summary.summary,
      evidenceLevels: summary.evidenceLevels,
    },
  }));
}

function rowsFromSkillProgress(
  progress: StudentProfile['skillProgress'],
  locale: Locale,
  t: Copy,
): { label: string; value: unknown }[] {
  return progress.map((item) => ({
    label: `${item.topic} / ${item.skill}`,
    value: {
      lessonType: t.tutor.lessonModes[item.lessonType],
      direction: t.settings.progressDirections[item.direction],
      confidence: item.confidence,
      supportNeeded: item.supportNeeded,
      independence: item.independence,
      evidence: item.evidence,
      createdAt: formatDateTime(item.createdAt, locale),
    },
  }));
}

function hasSettingValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

function formatSettingValue(value: unknown, emptyValue: string, t: Copy): string {
  if (!hasSettingValue(value)) {
    return emptyValue;
  }
  if (typeof value === 'boolean') {
    return value ? t.settings.yes : t.settings.no;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatSettingValue(item, emptyValue, t)).join(', ');
  }
  if (typeof value === 'object' && value) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => hasSettingValue(nestedValue))
      .map(
        ([nestedKey, nestedValue]) =>
          `${humanizeKey(nestedKey)}: ${formatSettingValue(nestedValue, emptyValue, t)}`,
      )
      .join('; ');
  }
  return String(value);
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function KnowledgeAdmin({ t }: { t: Copy }) {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      setStatus(await api<KnowledgeStatus>('/admin/knowledge/status'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.knowledgeStatus);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    try {
      await api('/admin/knowledge/files', { method: 'POST', body: form });
      setFile(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.upload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container size="lg" px={0} className="main-container">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1}>{t.knowledge.title}</Title>
            <Text c="dimmed">{t.knowledge.subtitle}</Text>
          </Box>
          <Button variant="default" leftSection={<RefreshCw size={18} />} onClick={() => void refresh()}>
            {t.common.refresh}
          </Button>
        </Group>

        <Card withBorder shadow="sm" padding="md" className="knowledge-card">
          <form onSubmit={upload}>
            <Group align="end">
              <FileInput
                className="file-input"
                label={t.knowledge.fileLabel}
                placeholder={t.knowledge.filePlaceholder}
                accept=".pdf,.md,.txt,.docx,.tex"
                value={file}
                onChange={setFile}
                size="md"
              />
              <Button
                type="submit"
                color="teal"
                loading={busy}
                disabled={!file}
                leftSection={<Upload size={18} />}
              >
                {t.knowledge.upload}
              </Button>
            </Group>
          </form>
        </Card>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <Card withBorder shadow="sm" padding="md" className="knowledge-card">
          <Text fw={900} mb="xs">
            {t.knowledge.vectorStore}
          </Text>
          <Group gap={6}>
            {(status?.vectorStoreIds ?? []).map((id) => (
              <Badge key={id} color="teal" variant="light">
                {id}
              </Badge>
            ))}
            {status && status.vectorStoreIds.length === 0 && (
              <Badge color="gray" variant="light">
                {t.knowledge.notCreated}
              </Badge>
            )}
          </Group>
          <Divider my="md" />
          <Table.ScrollContainer minWidth={620}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t.knowledge.file}</Table.Th>
                  <Table.Th>{t.knowledge.status}</Table.Th>
                  <Table.Th>{t.knowledge.size}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(status?.files ?? []).map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.originalName}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{item.status}</Badge>
                    </Table.Td>
                    <Table.Td>{formatBytes(item.sizeBytes)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    </Container>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default App;
