import { redirect } from '@/navigation';

interface SystematicPageProps {
  params: {
    locale: string;
  };
}

export default function SystematicRedirect({ params }: SystematicPageProps) {
  redirect(`/${params.locale}`);
}
