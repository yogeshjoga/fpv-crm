import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { GlassCard } from '../../components/ui/shared';
import { Button, Field, PageHeader, TextInput, useToast } from '../../components/ui/kit';

export function StudentProfile() {
  const { profile, refreshProfile, updatePassword } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile!.id);
    setSavingProfile(false);
    if (error) return toast(error.message, 'error');
    await refreshProfile();
    toast('Profile updated');
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast('Password must be at least 8 characters', 'error');
    if (pw !== pw2) return toast('Passwords do not match', 'error');
    setSavingPw(true);
    const { error } = await updatePassword(pw);
    setSavingPw(false);
    if (error) return toast(error, 'error');
    setPw('');
    setPw2('');
    toast('Password changed');
  };

  return (
    <div className="max-w-xl">
      <PageHeader title="Profile" />
      <GlassCard className="p-6">
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Full name">
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <TextInput value={profile?.email ?? ''} disabled />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
          </Field>
          <Button type="submit" loading={savingProfile}>
            Save changes
          </Button>
        </form>
      </GlassCard>

      <GlassCard className="mt-6 p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Change password</h2>
        <form onSubmit={changePw} className="space-y-4">
          <Field label="New password">
            <TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <TextInput type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" loading={savingPw}>
            Update password
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
