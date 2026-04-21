import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { IconDirective } from './icon.directive';

@Component({
  imports: [IconDirective],
  template: `
    <i appIcon="trash" id="default"></i>
    <i appIcon="settings" appIconSize="large" id="sized"></i>
    <i appIcon="video" class="caller-class" id="with-static-class"></i>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {}

describe('IconDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('applies icon + icon-name + default size=medium classes', () => {
    const el = fixture.debugElement.query(By.css('#default')).nativeElement as HTMLElement;
    expect(el.classList.contains('icon')).toBe(true);
    expect(el.classList.contains('icon-trash')).toBe(true);
    expect(el.classList.contains('icon--medium')).toBe(true);
  });

  it('applies the configured appIconSize', () => {
    const el = fixture.debugElement.query(By.css('#sized')).nativeElement as HTMLElement;
    expect(el.classList.contains('icon-settings')).toBe(true);
    expect(el.classList.contains('icon--large')).toBe(true);
  });

  it('preserves a caller-provided static class alongside directive classes', () => {
    const el = fixture.debugElement.query(By.css('#with-static-class'))
      .nativeElement as HTMLElement;
    expect(el.classList.contains('caller-class')).toBe(true);
    expect(el.classList.contains('icon')).toBe(true);
    expect(el.classList.contains('icon-video')).toBe(true);
  });
});
