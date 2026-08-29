import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { List } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { AppointmentCalendarContainer } from '../../components/appointments/calendar/AppointmentCalendarContainer';
import { Button } from '../../components/common/Button/Button';
import { Icon } from '../../components/common/Icon/Icon';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { ROUTES } from '../../routes/routes';

/**
 * AppointmentCalendarPage — /appointments/calendar route page.
 *
 * Thin composition layer mirroring AppointmentListPage: page-level PageHeader +
 * the calendar container. All orchestration (querying, filters, drawer) lives
 * in AppointmentCalendarContainer.
 */
export const AppointmentCalendarPage: FC = () => {
  const isMobile = useIsMobileViewport();
  const navigate = useNavigate();
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        {!isMobile && (
          <PageHeader
            title="Appointment Calendar"
            subtitle="View appointments in calendar format."
            actions={
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(ROUTES.APPOINTMENTS)}
                leftIcon={<Icon icon={List} size="md" />}
              >
                List View
              </Button>
            }
          />
        )}
        <AppointmentCalendarContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
