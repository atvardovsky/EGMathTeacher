import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from '../src/auth/auth.types';
import { StudentProfileController } from '../src/student-profile/student-profile.controller';

describe('StudentProfileController', () => {
  const studentRequest = {
    user: {
      id: 'student-1',
      name: 'Маша',
      role: 'student',
      createdAt: new Date().toISOString(),
      iat: 1,
      exp: 9_999_999_999,
    },
  } as AuthenticatedRequest;

  const createController = (structuredOnboardingEnabled: boolean) => {
    const service = {
      completeOnboarding: jest.fn().mockResolvedValue({
        onboardingRequired: false,
        profile: null,
      }),
      getStatus: jest.fn(),
      getMeetingReadiness: jest.fn(),
      completeOnboardingFromConversation: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'app.structuredOnboardingEnabled'
          ? structuredOnboardingEnabled
          : undefined,
      ),
    } as unknown as ConfigService;

    return {
      controller: new StudentProfileController(service as any, config),
      service,
    };
  };

  it('blocks legacy structured onboarding for students unless explicitly enabled', async () => {
    const { controller, service } = createController(false);

    await expect(controller.completeOnboarding(studentRequest, {} as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.completeOnboarding).not.toHaveBeenCalled();
  });

  it('allows legacy structured onboarding when the trusted fallback flag is enabled', async () => {
    const { controller, service } = createController(true);

    await expect(controller.completeOnboarding(studentRequest, {} as any)).resolves.toEqual({
      onboardingRequired: false,
      profile: null,
    });
    expect(service.completeOnboarding).toHaveBeenCalledWith({
      user: studentRequest.user,
      answers: {},
    });
  });
});
