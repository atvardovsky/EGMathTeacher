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
  Checkbox,
  Container,
  Divider,
  FileInput,
  Group,
  Image,
  MultiSelect,
  NavLink,
  NumberInput,
  Paper,
  PasswordInput,
  Pill,
  Progress,
  SegmentedControl,
  Select,
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
  Mic,
  RefreshCw,
  Send,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Square,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { api } from './api';
import {
  Copy,
  DIAGNOSTIC_PROMPTS,
  Locale,
  LOCALE_STORAGE_KEY,
  OPTION_SETS,
  QUICK_PROMPTS,
  TEXT,
  getInitialLocale,
  localizeOptions,
} from './i18n';
import {
  KnowledgeStatus,
  LessonType,
  StudentOnboardingAnswers,
  StudentProfile,
  StudentProfileStatus,
  TutorAnswer,
  TutorImageBlock,
  TutorImageResult,
  TutorLessonLifecycle,
  TutorResponseBlock,
  TutorTurn,
  UserUsageSummary,
  UsageTotals,
  User,
} from './types';

type View = 'tutor' | 'knowledge' | 'settings';
type AuthMode = 'login' | 'register';

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
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<StudentOnboardingAnswers>({
    exam: 'ЕГЭ',
    weakTopics: [],
    analogyInterests: [],
    diagnosticAnswers: DIAGNOSTIC_PROMPTS.map((prompt) => ({ prompt, answer: '' })),
    visualPreference: true,
  });
  const optionData = useMemo(
    () => ({
      exam: localizeOptions(OPTION_SETS.exam, locale),
      grade: localizeOptions(OPTION_SETS.grade, locale),
      level: localizeOptions(OPTION_SETS.level, locale),
      feeling: localizeOptions(OPTION_SETS.feeling, locale),
      feedback: localizeOptions(OPTION_SETS.feedback, locale),
      topics: localizeOptions(OPTION_SETS.topics, locale),
      explanation: localizeOptions(OPTION_SETS.explanation, locale),
      pacing: localizeOptions(OPTION_SETS.pacing, locale),
      practice: localizeOptions(OPTION_SETS.practice, locale),
      interests: localizeOptions(OPTION_SETS.interests, locale),
    }),
    [locale],
  );

  const stepCount = 4;
  const progressValue = ((step + 1) / stepCount) * 100;

  function update<K extends keyof StudentOnboardingAnswers>(
    key: K,
    value: StudentOnboardingAnswers[K],
  ) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function updateDiagnostic(index: number, answer: string) {
    setAnswers((current) => ({
      ...current,
      diagnosticAnswers: current.diagnosticAnswers.map((item, itemIndex) =>
        itemIndex === index ? { ...item, answer } : item,
      ),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await api<StudentProfileStatus>('/student-profile/me', {
        method: 'PUT',
        body: JSON.stringify(answers),
      });
      onComplete(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t.errors.onboardingSave);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-layout">
      <Card className="onboarding-card" withBorder shadow="xl" padding="xl">
        <form onSubmit={submit}>
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
                  onClick={(event) => {
                    event.preventDefault();
                    void onLogout();
                  }}
                >
                  {t.common.logout}
                </Button>
              </Group>
            </Group>

            <Paper withBorder radius="md" p="sm" className="meeting-status">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="indigo">
                    <Brain size={16} />
                  </ThemeIcon>
                  <Text fw={800}>{user.name}</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {t.onboarding.stepLabel(step + 1, stepCount)}
                </Text>
              </Group>
              <Progress
                value={progressValue}
                radius="xl"
                color="teal"
                aria-label={t.onboarding.progressLabel}
              />
            </Paper>

            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="xs">
              {t.onboarding.stepTitles.map((title, index) => (
                <Paper
                  key={title}
                  withBorder
                  radius="md"
                  p="sm"
                  className={index === step ? 'step-chip active' : 'step-chip'}
                >
                  <Text fw={800} ta="center" size="sm">
                    {title}
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>

            {error && (
              <Alert color="yellow" variant="light">
                {error}
              </Alert>
            )}

            {step === 0 && (
              <Stack>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <Select
                    label={t.onboarding.exam}
                    data={optionData.exam}
                    value={answers.exam}
                    onChange={(value) => update('exam', value ?? undefined)}
                  />
                  <Select
                    label={t.onboarding.grade}
                    data={optionData.grade}
                    value={answers.grade}
                    onChange={(value) => update('grade', value ?? undefined)}
                  />
                  <NumberInput
                    label={t.onboarding.targetScore}
                    min={0}
                    max={100}
                    clampBehavior="strict"
                    value={answers.targetScore}
                    onChange={(value) =>
                      update('targetScore', typeof value === 'number' ? value : undefined)
                    }
                  />
                </SimpleGrid>
                <TextInput
                  label={t.onboarding.motivation}
                  placeholder={t.onboarding.motivationPlaceholder}
                  value={answers.motivation ?? ''}
                  onChange={(event) => update('motivation', event.currentTarget.value)}
                />
              </Stack>
            )}

            {step === 1 && (
              <Stack>
                <SegmentedQuestion
                  label={t.onboarding.currentLevel}
                  value={answers.currentLevel ?? 'средне'}
                  data={optionData.level}
                  onChange={(value) => update('currentLevel', value)}
                />
                <SegmentedQuestion
                  label={t.onboarding.mathFeeling}
                  value={answers.mathFeeling ?? 'спокойно'}
                  data={optionData.feeling}
                  onChange={(value) => update('mathFeeling', value)}
                />
                <SegmentedQuestion
                  label={t.onboarding.feedbackStyle}
                  value={answers.feedbackStyle ?? 'спокойно и прямо'}
                  data={optionData.feedback}
                  onChange={(value) => update('feedbackStyle', value)}
                />
              </Stack>
            )}

            {step === 2 && (
              <Stack>
                <Checkbox.Group
                  label={t.onboarding.weakTopics}
                  value={answers.weakTopics}
                  onChange={(value) => update('weakTopics', value)}
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xs">
                    {optionData.topics.map((topic) => (
                      <Checkbox key={topic.value} value={topic.value} label={topic.label} />
                    ))}
                  </SimpleGrid>
                </Checkbox.Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Select
                    label={t.onboarding.explanationStyle}
                    data={optionData.explanation}
                    value={answers.explanationStyle}
                    onChange={(value) => update('explanationStyle', value ?? undefined)}
                  />
                  <Select
                    label={t.onboarding.pacing}
                    data={optionData.pacing}
                    value={answers.pacing}
                    onChange={(value) => update('pacing', value ?? undefined)}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Switch
                    label={t.onboarding.visualPreference}
                    checked={Boolean(answers.visualPreference)}
                    onChange={(event) => update('visualPreference', event.currentTarget.checked)}
                  />
                  <Select
                    label={t.onboarding.practicePreference}
                    data={optionData.practice}
                    value={answers.practicePreference}
                    onChange={(value) => update('practicePreference', value ?? undefined)}
                  />
                </SimpleGrid>

                <MultiSelect
                  label={t.onboarding.analogyInterests}
                  data={optionData.interests}
                  value={answers.analogyInterests}
                  onChange={(value) => update('analogyInterests', value)}
                  clearable
                />
              </Stack>
            )}

            {step === 3 && (
              <Stack>
                <Alert color="teal" variant="light">
                  {t.onboarding.diagnosticsNotice}
                </Alert>
                {answers.diagnosticAnswers.map((item, index) => (
                  <Textarea
                    key={item.prompt}
                    label={t.onboarding.diagnosticPrompts[index] ?? item.prompt}
                    placeholder={t.onboarding.diagnosticPlaceholder}
                    value={item.answer}
                    onChange={(event) => updateDiagnostic(index, event.currentTarget.value)}
                    autosize
                    minRows={2}
                  />
                ))}
                <Textarea
                  label={t.onboarding.freeform}
                  placeholder={t.onboarding.freeformPlaceholder}
                  value={answers.freeform ?? ''}
                  onChange={(event) => update('freeform', event.currentTarget.value)}
                  autosize
                  minRows={2}
                />
              </Stack>
            )}

            {submitError && (
              <Alert color="red" variant="light">
                {submitError}
              </Alert>
            )}

            <Group justify="space-between">
              <Button
                type="button"
                variant="default"
                disabled={step === 0 || busy}
                onClick={(event) => {
                  event.preventDefault();
                  setStep((current) => Math.max(0, current - 1));
                }}
              >
                {t.common.back}
              </Button>
              {step < stepCount - 1 ? (
                <Button
                  type="button"
                  color="teal"
                  onClick={(event) => {
                    event.preventDefault();
                    setStep((current) => current + 1);
                  }}
                >
                  {t.common.next}
                </Button>
              ) : (
                <Button type="submit" color="teal" loading={busy} leftSection={<Send size={18} />}>
                  {t.onboarding.submit}
                </Button>
              )}
            </Group>
          </Stack>
        </form>
      </Card>
    </div>
  );
}

function SegmentedQuestion({
  label,
  value,
  data,
  onChange,
}: {
  label: string;
  value: string;
  data: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Box>
      <Text fw={800} mb={6}>
        {label}
      </Text>
      <SegmentedControl fullWidth value={value} onChange={onChange} data={data} />
    </Box>
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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const speechSupported = useMemo(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
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

  useEffect(() => {
    void refreshUsage();
  }, []);

  async function refreshUsage(lessonSessionId?: string) {
    const query = lessonSessionId ? `?lessonSessionId=${encodeURIComponent(lessonSessionId)}` : '';
    try {
      setUsageSummary(await api<UserUsageSummary>(`/usage/me/summary${query}`));
    } catch {
      // Usage visibility must not block tutoring when the POC API is unavailable.
    }
  }

  function changeLessonType(value: string) {
    const nextLessonType = toLessonType(value);
    setLessonType((currentLessonType) => {
      if (nextLessonType !== currentLessonType) {
        setConversationId(undefined);
        setUsageSummary((currentSummary) =>
          currentSummary ? { ...currentSummary, currentLesson: null } : currentSummary,
        );
      }
      return nextLessonType;
    });
  }

  async function sendMessage(rawPrompt = draft, source: 'text' | 'voice' = 'text') {
    const prompt = rawPrompt.trim();
    if (!prompt || sending) {
      return;
    }
    setSending(true);
    setError(null);
    setDraft('');
    setVoiceInterim('');
    const id = crypto.randomUUID();
    const currentLessonType = lessonType;
    setTurns((current) => [{ id, prompt, source, lessonType: currentLessonType }, ...current]);
    try {
      const answer = await api<TutorAnswer>('/tutor/message', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          conversationId,
          source,
          lessonType: currentLessonType,
        }),
      });
      setConversationId(answer.conversationId);
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, answer } : turn)),
      );
      void refreshUsage(answer.lessonLifecycle?.lessonSessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.tutor);
      setTurns((current) => current.filter((turn) => turn.id !== id));
    } finally {
      setSending(false);
    }
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError(t.errors.speechUnsupported);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = locale === 'ru' ? 'ru-RU' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    let finalText = '';
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
      setVoiceInterim(interim.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceInterim('');
      setError(t.errors.speechFailed);
    };
    recognition.onend = () => {
      setListening(false);
      setVoiceInterim('');
      const spoken = finalText.trim();
      if (spoken) {
        void sendMessage(spoken, 'voice');
      }
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function useQuickPrompt(text: string) {
    setDraft(text);
    textareaRef.current?.focus();
  }

  async function generateImage(turn: TutorTurn, block: TutorImageBlock) {
    if (!block.prompt || turn.loadingImages?.[block.id]) {
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
        }),
      });
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id
            ? {
                ...item,
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
            <Badge size="lg" variant="light" color={conversationId ? 'teal' : 'gray'}>
              {conversationId ? t.tutor.conversationActive : t.tutor.newConversation}
            </Badge>
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
            data={[
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
              onClick={() => useQuickPrompt(prompt.text)}
              aria-disabled={sending || listening}
            >
              {prompt.label}
            </Pill>
          ))}
        </Group>

        <UsageBar
          t={t}
          locale={locale}
          summary={usageSummary}
          lifecycle={activeLifecycle}
          expanded={usageExpanded}
          onToggle={() => setUsageExpanded((current) => !current)}
        />

        <Card withBorder shadow="sm" padding="md" className="tutor-composer">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <Stack>
              <Textarea
                ref={textareaRef}
                value={listening ? voiceInterim || draft : draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                placeholder={t.tutor.placeholder}
                autosize
                minRows={3}
                maxRows={7}
                disabled={listening}
                size="md"
              />
              <Group justify="flex-end" gap="sm">
                <Tooltip label={speechSupported ? t.tutor.voiceTitle : t.tutor.voiceUnavailable}>
                  <ActionIcon
                    size="xl"
                    variant={listening ? 'filled' : 'light'}
                    color={listening ? 'red' : 'teal'}
                    onClick={listening ? stopVoice : startVoice}
                    disabled={!speechSupported || sending}
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
                  disabled={!draft.trim()}
                  leftSection={<Send size={18} />}
                >
                  {t.tutor.ask}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <Stack gap="md">
          {turns.length === 0 && (
            <Paper withBorder radius="lg" p="xl" className="empty-state">
              <ThemeIcon size="xl" variant="light" color="teal">
                <FileText size={28} />
              </ThemeIcon>
              <Text fw={800}>{t.tutor.emptyTitle}</Text>
              <Text c="dimmed" size="sm" ta="center">
                {t.tutor.emptyBody}
              </Text>
            </Paper>
          )}
          {turns.map((turn) => (
            <TutorTurnCard key={turn.id} t={t} turn={turn} onGenerateImage={generateImage} />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}

function UsageBar({
  t,
  locale,
  summary,
  lifecycle,
  expanded,
  onToggle,
}: {
  t: Copy;
  locale: Locale;
  summary: UserUsageSummary | null;
  lifecycle?: TutorLessonLifecycle;
  expanded: boolean;
  onToggle: () => void;
}) {
  const today = summary?.today ?? emptyUsageTotals();
  const lesson = summary?.currentLesson?.total ?? emptyUsageTotals();
  const details = summary?.currentLesson?.items ?? [];
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
                {needsPricingNote ? t.tutor.usage.pricingNotConfigured : t.tutor.usage.subtitle}
              </Text>
            </Box>
          </Group>
          <Button variant="subtle" size="xs" onClick={onToggle}>
            {expanded ? t.tutor.usage.hideDetails : t.tutor.usage.details}
          </Button>
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
                      <Table.Td>{formatCurrency(item.estimatedCostUsd)}</Table.Td>
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
  onGenerateImage,
}: {
  t: Copy;
  turn: TutorTurn;
  onGenerateImage: (turn: TutorTurn, block: TutorImageBlock) => Promise<void>;
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
            <TutorBlockList t={t} turn={turn} onGenerateImage={onGenerateImage} />

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
  return `${formatCurrency(totals.estimatedCostUsd)}${totals.pricingConfigured ? '' : '*'}`;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${minutes}m`;
}

function TutorBlockList({
  t,
  turn,
  onGenerateImage,
}: {
  t: Copy;
  turn: TutorTurn;
  onGenerateImage: (turn: TutorTurn, block: TutorImageBlock) => Promise<void>;
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
}: {
  t: Copy;
  turn: TutorTurn;
  block: TutorResponseBlock;
  showTextTitle: boolean;
  onGenerateImage: (turn: TutorTurn, block: TutorImageBlock) => Promise<void>;
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
    <Box className="image-block">
      <Text fw={800} size="sm" mb={6}>
        {block.caption}
      </Text>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={block.altText || t.tutor.imageAlt}
          radius="md"
          className="generated-image"
        />
      ) : (
        <Button
          variant={block.priority === 'required' ? 'filled' : 'light'}
          color="indigo"
          leftSection={loading ? <Loader2 className="spin" size={18} /> : <ImageIcon size={18} />}
          onClick={() => void onGenerateImage(turn, block)}
          disabled={loading}
        >
          {t.tutor.showImage}
        </Button>
      )}
    </Box>
  );
}

function getTutorBlocks(answer: TutorAnswer, imageAlt: string): TutorResponseBlock[] {
  if (Array.isArray(answer.blocks) && answer.blocks.length > 0) {
    return answer.blocks;
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
