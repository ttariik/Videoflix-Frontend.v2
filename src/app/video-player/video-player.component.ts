import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  inject,
  OnDestroy,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { VideoService } from '../services/video.service';

import Hls from 'hls.js';
import { ApiService } from '../services/api.service';
import { VideoProgress } from '../interfaces/videoprogress.interface';
import { Video } from '../interfaces/video.interface';

interface QualityOption {
  label: string;
  src: string;
}

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.scss',
})
export class VideoPlayerComponent implements AfterViewInit, OnDestroy {
  videoService = inject(VideoService);
  apiService = inject(ApiService);
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  currentQualityLabel = 'Auto';
  showQualityMenu = false;
  availableQualities: QualityOption[] = [];
  userToken: string | null = null;
  videoId: number = 0;
  showButtons = true;
  private initialized = false;

  handleBeforeUnload(event: Event) {
    this.saveProgress();
  }

  ngAfterViewInit() {
    const selectedVideo = this.videoService.selectedVideo();
    if (selectedVideo) {
      this.initializeQualities(selectedVideo);
      
      setTimeout(() => {
        this.loadVideoBasedOnResolution(selectedVideo);
        this.initialized = true;
      });

      if (selectedVideo['startTime']) {
        const videoElement = this.videoPlayer.nativeElement;
        videoElement.onloadedmetadata = () => {
          videoElement.currentTime = selectedVideo['startTime'] || 0;
        };
      }
    }
    this.userToken = localStorage.getItem('token');
  }

  private initializeQualities(selectedVideo: Video) {
    const allQualities = [
      { label: '1080p', src: selectedVideo.video_1080p || '' },
      { label: '720p', src: selectedVideo.video_720p || '' },
      { label: '360p', src: selectedVideo.video_360p || '' },
      { label: '120p', src: selectedVideo.video_120p || '' }
    ];
    
    this.availableQualities = [
      { label: 'Auto', src: '' },
      ...allQualities
    ];

    if (selectedVideo.video_file && selectedVideo.video_file.trim() !== '') {
      this.availableQualities.push({ label: 'Original', src: selectedVideo.video_file });
    }
  }

  loadVideoBasedOnResolution(selectedVideo: Video) {
    const width = screen.width;
    let selectedResolution: QualityOption | undefined;

    const availableQualities = this.availableQualities.filter(q => q.src && q.label !== 'Auto');

    if (this.currentQualityLabel === 'Auto' && availableQualities.length > 0) {
      if (width <= 480) {
        selectedResolution = availableQualities.find(q => q.label === '120p') || availableQualities[0];
      } else if (width <= 768) {
        selectedResolution = availableQualities.find(q => q.label === '360p') || availableQualities[0];
      } else if (width <= 1366) {
        selectedResolution = availableQualities.find(q => q.label === '720p') || availableQualities[0];
      } else {
        selectedResolution = availableQualities.find(q => q.label === '1080p') || availableQualities[0];
      }
    } else {
      selectedResolution = this.availableQualities.find(q => q.label === this.currentQualityLabel);
    }

    if (selectedResolution && selectedResolution.src) {
      this.loadVideo(selectedResolution.src);
      if (this.initialized) {
        this.currentQualityLabel = selectedResolution.label;
      }
    } else if (selectedVideo.video_file) {
      this.loadVideo(selectedVideo.video_file);
      if (this.initialized) {
        this.currentQualityLabel = 'Original';
      }
    }
  }

  loadVideo(url: string) {
    if (!url) {
      console.error('Ungültige Video-URL');
      return;
    }

    const videoElement = this.videoPlayer.nativeElement;
    try {
      if (Hls.isSupported() && url.endsWith('.m3u8')) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Netzwerkfehler beim Laden des Videos');
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Medienfehler beim Laden des Videos');
                break;
              default:
                console.error('Unbekannter HLS Fehler');
                break;
            }
          }
        });
      } else {
        videoElement.src = url;
      }
      videoElement.load();
    } catch (error) {
      console.error('Fehler beim Laden des Videos:', error);
    }
  }

  startVideo() {
    const videoElement = this.videoPlayer.nativeElement;
    videoElement.play();
    this.showButtons = false;
  }

  continueVideo() {
    const selectedVideo = this.videoService.selectedVideo();
    if (selectedVideo && selectedVideo['startTime']) {
      const videoElement = this.videoPlayer.nativeElement;
      videoElement.currentTime = selectedVideo['startTime'];
      videoElement.play();
      this.showButtons = false;
    }
  }

  restartVideo() {
    const videoElement = this.videoPlayer.nativeElement;
    videoElement.currentTime = 0;
    videoElement.play();
    this.showButtons = false;
  }

  toggleQualityMenu() {
    this.showQualityMenu = !this.showQualityMenu;
  }

  changeQuality(quality: QualityOption) {
    this.showQualityMenu = false;
    const videoElement = this.videoPlayer.nativeElement;
    const currentTime = videoElement.currentTime;
    const wasPlaying = !videoElement.paused;
    
    if (quality.label === 'Auto') {
      const selectedVideo = this.videoService.selectedVideo();
      if (selectedVideo) {
        this.currentQualityLabel = 'Auto';
        this.loadVideoBasedOnResolution(selectedVideo);
      }
    } else {
      const selectedQuality = this.availableQualities.find(q => q.label === quality.label);
      
      if (!selectedQuality || !selectedQuality.src) {
        const selectedVideo = this.videoService.selectedVideo();
        if (selectedVideo) {
          const availableQualities = this.availableQualities.filter(q => q.src && q.label !== 'Auto');
          if (availableQualities.length > 0) {
            const nextBestQuality = availableQualities[0];
            this.currentQualityLabel = nextBestQuality.label;
            this.loadVideo(nextBestQuality.src);
          } else if (selectedVideo.video_file) {
            this.currentQualityLabel = 'Original';
            this.loadVideo(selectedVideo.video_file);
          }
        }
      } else {
        this.currentQualityLabel = quality.label;
        this.loadVideo(selectedQuality.src);
      }
    }

    videoElement.onloadedmetadata = () => {
      videoElement.currentTime = currentTime;
      if (wasPlaying) {
        videoElement.play().catch(error => {
          console.error('Fehler beim Abspielen:', error);
        });
      }
    };
  }

  private setVideoSource(videoElement: HTMLVideoElement, quality: QualityOption) {
    try {
      if (quality.label === 'Auto') {
        const selectedVideo = this.videoService.selectedVideo();
        if (selectedVideo) {
          this.loadVideoBasedOnResolution(selectedVideo);
        }
      } else {
        const selectedQuality = this.availableQualities.find(q => q.label === quality.label);
        if (selectedQuality && selectedQuality.src) {
          videoElement.src = selectedQuality.src;
          this.currentQualityLabel = quality.label;
          videoElement.load();
        } else {
          console.error(`Qualität ${quality.label} nicht verfügbar`);
        }
      }
    } catch (error) {
      console.error('Fehler beim Ändern der Videoqualität:', error);
    }
  }

  closePlayer() {
    this.saveProgress();
    this.videoService.isPlayerOpen.set(false);
    const videoElement = this.videoPlayer.nativeElement;
    videoElement.pause();
  }

  rewindVideo() {
    const videoElement = this.videoPlayer.nativeElement;
    videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
  }

  fastForwardVideo() {
    const videoElement = this.videoPlayer.nativeElement;
    videoElement.currentTime = Math.min(
      videoElement.duration,
      videoElement.currentTime + 10
    );
  }

  async saveProgress() {
    const videoElement = this.videoPlayer.nativeElement;
    const currentTime = videoElement.currentTime;
    const postData = {
      video: this.videoService.selectedVideo()?.id,
      last_viewed_position: currentTime,
      viewed: currentTime >= videoElement.duration,
    };
    const token = localStorage.getItem('token');
    if (token) {
      await firstValueFrom(this.apiService.post(postData, 'progress/', token));
    }
  }

  ngOnDestroy() {
    this.saveProgress();
  }
}
