import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Video, RefreshCw } from "lucide-react";

interface TaskVideo {
  id: string;
  youtube_id: string;
  title: string;
  vip_level_code: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

type FormData = Omit<TaskVideo, "id" | "created_at">;

const emptyForm: FormData = {
  youtube_id: "",
  title: "",
  vip_level_code: null,
  is_active: true,
  sort_order: 0,
};

const AdminTasks = () => {
  const [videos, setVideos] = useState<TaskVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [vipLevels, setVipLevels] = useState<{ level_code: string; display_name: string }[]>([]);

  const fetchVideos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("task_videos")
      .select("*")
      .order("sort_order", { ascending: true });
    setVideos((data as TaskVideo[]) || []);
    setLoading(false);
  };

  const fetchVipLevels = async () => {
    const { data } = await supabase
      .from("vip_levels")
      .select("level_code, display_name")
      .order("sort_order", { ascending: true });
    setVipLevels((data as any[]) || []);
  };

  useEffect(() => {
    fetchVideos();
    fetchVipLevels();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: videos.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (v: TaskVideo) => {
    setEditingId(v.id);
    setForm({
      youtube_id: v.youtube_id,
      title: v.title,
      vip_level_code: v.vip_level_code,
      is_active: v.is_active,
      sort_order: v.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.youtube_id.trim() || !form.title.trim()) {
      toast.error("YouTube ID e título são obrigatórios");
      return;
    }
    setSaving(true);

    const payload = {
      youtube_id: form.youtube_id.trim(),
      title: form.title.trim(),
      vip_level_code: form.vip_level_code || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    if (editingId) {
      const { error } = await supabase
        .from("task_videos")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Vídeo atualizado");
    } else {
      const { error } = await supabase
        .from("task_videos")
        .insert(payload);
      if (error) toast.error("Erro ao criar");
      else toast.success("Vídeo adicionado");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchVideos();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("task_videos").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else toast.success("Vídeo excluído");
    setDeleteId(null);
    fetchVideos();
  };

  const toggleActive = async (v: TaskVideo) => {
    await supabase
      .from("task_videos")
      .update({ is_active: !v.is_active })
      .eq("id", v.id);
    fetchVideos();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Gerenciar Vídeos de Tarefas
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchVideos}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Vídeo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Carregando...</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>YouTube ID</TableHead>
                    <TableHead>Nível VIP</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.sort_order}</TableCell>
                      <TableCell>
                        <img
                          src={`https://img.youtube.com/vi/${v.youtube_id}/default.jpg`}
                          alt={v.title}
                          className="w-20 h-auto rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{v.title}</TableCell>
                      <TableCell className="font-mono text-xs">{v.youtube_id}</TableCell>
                      <TableCell className="text-xs">
                        {v.vip_level_code
                          ? vipLevels.find((l) => l.level_code === v.vip_level_code)?.display_name || v.vip_level_code
                          : "Todos"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={v.is_active} onCheckedChange={() => toggleActive(v)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(v.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {videos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum vídeo cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Vídeo" : "Adicionar Vídeo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>YouTube ID</Label>
              <Input
                placeholder="ex: dQw4w9WgXcQ"
                value={form.youtube_id}
                onChange={(e) => setForm({ ...form, youtube_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                placeholder="Título do vídeo"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nível VIP (opcional)</Label>
              <Select
                value={form.vip_level_code || "__all__"}
                onValueChange={(v) => setForm({ ...form, vip_level_code: v === "__all__" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os níveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os níveis</SelectItem>
                  {vipLevels.map((l) => (
                    <SelectItem key={l.level_code} value={l.level_code}>
                      {l.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Ativo</Label>
            </div>
            {form.youtube_id && (
              <img
                src={`https://img.youtube.com/vi/${form.youtube_id}/mqdefault.jpg`}
                alt="Preview"
                className="w-full rounded"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este vídeo? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTasks;
