import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { FileVideo, Upload } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { FormEvent, useMemo, useState, useRef } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from '@/lib/axios'

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

const statusMessages = {
  converting: 'Convertendo...',
  generating: 'Transcrevendo...',
  uploading: 'Carregando...',
  success: 'Sucesso!'
}

interface VideoInputFormProps {
  onVideoUploaded: (id: string) => void
}

export function VideoInputForm(props: VideoInputFormProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('waiting')

  //ref é uma referência para um elemento do DOM
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  function handleFIleSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const { files } = event.currentTarget

    if (!files) return

    const file = files[0];

    setVideoFile(file);

  }

  async function convertToAudio(video: File) {
    //converter video em audio
    console.log("Convert started.")

    const ffmpeg = await getFFmpeg()

    await ffmpeg.writeFile('input.mp4', await fetchFile(video))

    ffmpeg.on('progress', progress => {
      console.log('Convert progress: ' + Math.round(progress.progress * 100))
    })

    await ffmpeg.exec([
      '-i',
      'input.mp4',
      '-map',
      '0:a',
      '-b:a',
      '20K',
      '-acodec',
      'libmp3lame',
      'output.mp3'
    ])

    const data = await ffmpeg.readFile('output.mp3')

    const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
    const audioFile = new File([audioFileBlob], 'output.mp3', {
      type: 'audio/mpeg',
    })

    console.log('Convert finished.')

    return audioFile
  }

  async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = promptInputRef.current?.value

    if (!videoFile) {
      return
    }

    setStatus('converting')

    // converter video em audio
    const audioFile = await convertToAudio(videoFile)

    const data = new FormData();

    data.append('file', audioFile);

    setStatus('uploading')

    const response = await api.post('/videos', data)

    const videoId = response.data.video.id

    setStatus('generating')

    await api.post(`/videos/${videoId}/transcription`, {
      prompt,
    })

    setStatus('success')

    props.onVideoUploaded(videoId)
  }

  const previewURL = useMemo(() => {
    if (!videoFile) return null

    return URL.createObjectURL(videoFile)
  }, [videoFile])

  return (
    <form className='space-y-4' onSubmit={handleUploadVideo}>
      <label
        htmlFor="video"
        className='border relative flex w-full rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-zinc-100/20'>
        {previewURL ? (
          <video src={previewURL} controls={false} className="pointer-events-none inset-0"/>
        ) : (
          <>
            <FileVideo className='w-4 h-4' />
            Selecione um video
          </>
        )}
      </label>

      <input type="file" id='video' accept='video/mp4' className='sr-only' onChange={handleFIleSelected} />

      <Separator />

      <div className='space-y-2'>
        <Label htmlFor='transcription_prompt'>Prompt de transcrição</Label>
        <Textarea ref={promptInputRef} disabled={status != 'waiting'} id='transcription_prompt' className='h-20 resize-none leading-relaxed' placeholder='Inclua palavras chave mencionadas no vídeo separadas por vírgula' />
      </div>

      <Button data-success={status === 'success'} disabled={status != 'waiting'} type='submit' className='w-full data-[success=true]:bg-emerald-400 data-[success=true]:text-zinc-950'>
        {status == 'waiting' ? (
          <>
            Carregar vídeo
            <Upload className='w-4 h-4 ml-2' />
          </>
        ) : statusMessages[status]}
      </Button>
    </form>
  )
}